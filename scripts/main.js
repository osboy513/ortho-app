import { searchNCBI, fetchAllArticlesForExport } from './api_service.js';
import { generateAiSearchQuery, rankAiSearchResults } from './ai_search_service.js';
import { AI_PROVIDER_PRESETS, clearAiSettings, getSummaryServiceStatus, loadAiSettings, resolveSelectedModel, saveAiSettings } from './summary_service.js';
import { displayArticles, showInitialLoadingIndicator, clearResultsDisplay, displayResultsCount, displayGlobalError, clearGlobalError, appendArticles, showInfiniteScrollLoader, hideInfiniteScrollLoader, showNoMoreResults, hideNoMoreResults, showEmptyState, hideEmptyState } from './ui_manager.js';
import { journalCategories } from './journal_data.js?v=18';

// 설정 값
const CONFIG = {
    articlesPerPage: 15
};
const AI_SEARCH_MODE_STORAGE_KEY = 'ortho.aiSearch.enabled';

// 서비스 워커 등록
if ('serviceWorker' in navigator) {
    let refreshingForServiceWorker = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshingForServiceWorker) {
            return;
        }
        refreshingForServiceWorker = true;
        window.location.reload();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
            .then(async registration => {
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) {
                        return;
                    }

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });

                await registration.update();
            })
            .catch(error => {
                console.error('서비스 워커 등록 실패:', error);
            });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // UI 및 설정 초기화
    initUI();
    initSettings();

    // 현재 연도 표시
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Lucide 아이콘 초기화
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Export List 버튼 이벤트 리스너 등록
    const exportBtn = document.getElementById('export-list-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const spinner = exportBtn.querySelector('.export-spinner');
            spinner.classList.remove('hidden');
            exportBtn.disabled = true;
            try {
                // 기간/저널 선택값 추출
                const startDate = document.getElementById('start-date')?.value;
                const endDate = document.getElementById('end-date')?.value;
                const checkedJournals = getSelectedJournalSearchTerms(document);
                const checkedJournalNames = getSelectedJournalNames(document);
                if (!endDate || checkedJournals.length === 0) {
                    alert('종료일과 저널을 선택해 주세요.');
                    return;
                }
                // 검색어(키워드)도 포함
                const keywords = document.getElementById('keywords')?.value?.trim() || '';
                const aiSearchEnabled = Boolean(document.getElementById('ai-search-toggle')?.checked);
                let exportTerm = keywords;

                if (aiSearchEnabled) {
                    if (!keywords) {
                        alert('AI 검색 질문을 입력해 주세요.');
                        return;
                    }

                    const aiSearchData = await generateAiSearchQuery({
                        question: keywords,
                        startDate,
                        endDate,
                        journals: checkedJournalNames
                    });
                    exportTerm = aiSearchData.pubmedQuery;
                }

                // 논문 전체 데이터 fetch
                const articles = await fetchAllArticlesForExport({
                    startDate,
                    endDate,
                    journals: checkedJournals,
                    term: exportTerm
                });
                if (!articles.length) {
                    alert('해당 조건에 맞는 논문이 없습니다.');
                    return;
                }
                // CSV 변환
                const rows = [
                    ['제목', '저자', '저널명', '출간일', 'DOI', '논문 링크']
                ];
                articles.forEach(a => {
                    rows.push([
                        a.title || '',
                        a.authors || '',
                        a.journalName || '',
                        a.publicationDate || '',
                        a.doi || '',
                        a.pmidLink || ''
                    ]);
                });
                const csvContent = rows.map(row => row.map(field => '"' + (field || '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const fileRange = startDate ? `${startDate}_${endDate}` : `until_${endDate}`;
                a.download = `Ortho_PubMed_${fileRange}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (e) {
                alert('논문 내보내기 중 오류 발생: ' + (e.message || e));
            } finally {
                spinner.classList.add('hidden');
                const aiExportEnabled = Boolean(document.getElementById('ai-search-toggle')?.checked);
                const exportKeywordReady = !aiExportEnabled || Boolean(document.getElementById('keywords')?.value?.trim());
                const canExport = Boolean(
                    document.getElementById('end-date')?.value &&
                    document.querySelectorAll('.journal-checkbox:checked').length &&
                    exportKeywordReady
                );
                exportBtn.disabled = !canExport;
            }
        });
    }
});

// 설정 관리 초기화 함수
function initSettings() {
    const statusElement = document.getElementById('summary-service-status');
    const modelElement = document.getElementById('summary-service-model');
    const cacheElement = document.getElementById('summary-service-cache');
    const refreshButton = document.getElementById('check-summary-service-btn');
    const providerSelect = document.getElementById('ai-provider');
    const modelSelect = document.getElementById('ai-model');
    const customModelField = document.getElementById('custom-model-field');
    const customModelInput = document.getElementById('ai-custom-model');
    const apiKeyInput = document.getElementById('ai-api-key');
    const saveSettingsButton = document.getElementById('save-ai-settings-btn');
    const clearSettingsButton = document.getElementById('clear-ai-settings-btn');
    const settingsMessage = document.getElementById('ai-settings-message');

    if (!statusElement || !modelElement || !cacheElement || !refreshButton || !providerSelect || !modelSelect || !apiKeyInput) {
        console.warn('설정 UI 요소를 찾을 수 없습니다.');
        return;
    }

    function populateModelOptions(provider, selectedModel = '') {
        const preset = AI_PROVIDER_PRESETS[provider] || AI_PROVIDER_PRESETS.openai;
        modelSelect.replaceChildren();

        preset.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            modelSelect.appendChild(option);
        });

        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '직접 입력';
        modelSelect.appendChild(customOption);

        const availableValues = preset.models.map(model => model.value).concat('custom');
        modelSelect.value = availableValues.includes(selectedModel) ? selectedModel : preset.models[0].value;
        apiKeyInput.placeholder = preset.apiKeyPlaceholder;
        customModelField?.classList.toggle('hidden', modelSelect.value !== 'custom');
    }

    function applySettingsToForm(settings = loadAiSettings()) {
        providerSelect.value = settings.provider;
        populateModelOptions(settings.provider, settings.model);
        customModelInput.value = settings.customModel || '';
        apiKeyInput.value = settings.apiKey || '';
    }

    function setSettingsMessage(message, variant = 'neutral') {
        if (!settingsMessage) {
            return;
        }
        settingsMessage.textContent = message;
        settingsMessage.dataset.variant = variant;
    }

    async function updateSummaryServiceStatus(forceRefresh = false) {
        statusElement.textContent = '요약 서비스 상태 확인 중...';
        statusElement.className = 'status-pill neutral';
        refreshButton.disabled = true;

        const status = await getSummaryServiceStatus(forceRefresh);

        if (status.userConfigured && status.unavailable) {
            statusElement.textContent = '사용자 API 키는 저장되어 있지만, 서버리스 요약 API에 연결할 수 없습니다.';
            statusElement.className = 'status-pill warning';
        } else if (status.userConfigured) {
            statusElement.textContent = `사용 가능: ${AI_PROVIDER_PRESETS[status.provider]?.label || status.provider} 사용자 API 키를 사용합니다.`;
            statusElement.className = 'status-pill success';
        } else if (status.configured) {
            statusElement.textContent = '사용 가능: 운영자 서버 환경변수 OPENAI_API_KEY가 설정되어 있습니다.';
            statusElement.className = 'status-pill success';
        } else if (status.unavailable) {
            statusElement.textContent = '연결 불가: Vercel/서버리스 환경에서 실행 중인지 확인해주세요.';
            statusElement.className = 'status-pill warning';
        } else {
            statusElement.textContent = '설정 필요: 배포 환경에 OPENAI_API_KEY를 등록해주세요.';
            statusElement.className = 'status-pill danger';
        }

        modelElement.textContent = status.model || 'N/A';
        cacheElement.textContent = status.cache || 'N/A';
        refreshButton.disabled = false;
    }

    providerSelect.addEventListener('change', () => {
        populateModelOptions(providerSelect.value);
    });

    modelSelect.addEventListener('change', () => {
        customModelField?.classList.toggle('hidden', modelSelect.value !== 'custom');
    });

    saveSettingsButton?.addEventListener('click', async () => {
        const savedSettings = saveAiSettings({
            provider: providerSelect.value,
            model: modelSelect.value,
            customModel: customModelInput?.value || '',
            apiKey: apiKeyInput.value
        });
        const selectedModel = resolveSelectedModel(savedSettings);

        if (!savedSettings.apiKey || !selectedModel) {
            setSettingsMessage('회사, 모델, API 키를 모두 입력해야 사용자 키로 요약할 수 있습니다.', 'warning');
        } else {
            setSettingsMessage('저장되었습니다. 다음 AI 요약부터 이 브라우저의 사용자 API 키를 사용합니다.', 'success');
        }

        await updateSummaryServiceStatus(true);
    });

    clearSettingsButton?.addEventListener('click', async () => {
        const clearedSettings = clearAiSettings();
        applySettingsToForm(clearedSettings);
        setSettingsMessage('사용자 API 설정을 삭제했습니다. 운영자 기본 설정이 있으면 그 설정을 사용합니다.', 'neutral');
        await updateSummaryServiceStatus(true);
    });

    applySettingsToForm();
    refreshButton.addEventListener('click', () => updateSummaryServiceStatus(true));
    updateSummaryServiceStatus();
}

// 초기 UI 설정
function initUI() {
    const searchButton = document.getElementById('search-button');
    const searchButtonText = searchButton?.querySelector('.search-text');
    const searchButtonIcon = searchButton?.querySelector('.search-icon');
    const searchButtonSpinner = searchButton?.querySelector('.spinner');

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const keywordsInput = document.getElementById('keywords');
    const aiSearchToggle = document.getElementById('ai-search-toggle');
    const journalFilterContainer = document.getElementById('journal-filter-container');
    const articlesListElement = document.getElementById('articles-list');
    const scrollSentinel = document.getElementById('scroll-sentinel');
    const rightPanelScroller = document.getElementById('right-panel-scroller');
    const exportButton = document.getElementById('export-list-btn');
    const selectedJournalsCountElement = document.getElementById('selected-journals-count');
    const selectedJournalsSummaryElement = document.getElementById('selected-journals-summary');
    const clearJournalsButton = document.getElementById('clear-journals-btn');
    const searchContextElement = document.getElementById('search-context');
    const rangePresetButtons = document.querySelectorAll('.range-preset');

    // 필수 요소 존재 확인
    if (!searchButton || !startDateInput || !endDateInput || !journalFilterContainer || !rightPanelScroller) {
        console.error('필수 UI 요소를 찾을 수 없습니다.');
        return;
    }

    // 검색 상태 관리 변수
    let currentSearchQuery = null;
    let currentRetstart = 0;
    let isLoadingMore = false;
    let allArticlesLoaded = false;
    let hasMore = true;
    let deferredNoAbstractArticles = [];

    // 날짜 입력 필드 초기화
    initDateFields(startDateInput, endDateInput);
    initAiSearchMode(aiSearchToggle, keywordsInput);

    // 검색 버튼 클릭 이벤트
    searchButton.addEventListener('click', () => performSearch(true));

    // 저널 필터 UI 설정
    setupJournalFilters(journalFilterContainer);
    syncFormState();

    rangePresetButtons.forEach(button => {
        button.addEventListener('click', () => {
            const months = Number(button.dataset.months || 12);
            setDateRangeMonths(startDateInput, endDateInput, months);
            rangePresetButtons.forEach(preset => preset.classList.toggle('active', preset === button));
            syncFormState();
        });
    });

    [startDateInput, endDateInput].forEach(input => {
        input.addEventListener('input', () => {
            rangePresetButtons.forEach(button => button.classList.remove('active'));
        });
    });

    keywordsInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && syncFormState()) {
            performSearch(true);
        }
    });

    aiSearchToggle?.addEventListener('change', () => {
        setAiSearchPreference(aiSearchToggle.checked);
        applyAiSearchModeState(aiSearchToggle, keywordsInput);
        syncFormState();
    });

    clearJournalsButton?.addEventListener('click', () => {
        clearJournalSelection(journalFilterContainer);
        syncFormState();
    });

    // IntersectionObserver를 사용한 무한 스크롤 설정
    if (scrollSentinel && rightPanelScroller) {
        setupInfiniteScroll(scrollSentinel, rightPanelScroller, () => {
            if (isLoadingMore || allArticlesLoaded || !currentSearchQuery || !hasMore) {
                return;
            }

            performSearch(false);
        });
    }

    // 폼 입력 유효성 실시간 검사 및 검색 버튼 상태 업데이트
    const formElements = [startDateInput, endDateInput, keywordsInput].filter(Boolean);
    formElements.forEach(el => {
        el.addEventListener('input', syncFormState);
    });

    // 저널 체크박스 변경 시 검색 버튼 상태 업데이트
    // 저널 체크박스 변경 시 검색 버튼 상태 업데이트 (이벤트 위임 사용)
    journalFilterContainer.addEventListener('change', (e) => {
        // 체크박스 변경인 경우에만 상태 업데이트
        if (e.target.type === 'checkbox') {
            syncFormState();
        }
    });

    function syncFormState() {
        const isValid = updateSearchButtonState(startDateInput, endDateInput, journalFilterContainer, searchButton, {
            requireKeywords: Boolean(aiSearchToggle?.checked),
            keywordsInput
        });
        if (exportButton) {
            exportButton.disabled = !isValid;
        }
        updateSelectedJournalSummary(
            journalFilterContainer,
            selectedJournalsCountElement,
            selectedJournalsSummaryElement,
            clearJournalsButton
        );
        return isValid;
    }

    // 검색 수행 함수
    async function performSearch(isNewSearch) {
        // 검색이 진행 중이거나 모든 결과를 이미 로드한 경우 중단
        if ((isLoadingMore && !isNewSearch) || (allArticlesLoaded && !isNewSearch)) {
            isLoadingMore = false;
            hideInfiniteScrollLoader();
            return false;
        }

        let searchInputs = null;

        // 새 검색인 경우 UI 초기화 및 검색 쿼리 구성
        if (isNewSearch) {
            searchInputs = validateAndBuildSearchQuery(startDateInput, endDateInput, journalFilterContainer, keywordsInput, {
                aiSearchEnabled: Boolean(aiSearchToggle?.checked)
            });
            if (!searchInputs) {
                resetSearchButton();
                return false;
            }

            currentRetstart = 0;
            allArticlesLoaded = false;
            hasMore = true;
            deferredNoAbstractArticles = [];

            clearGlobalError();
            clearResultsDisplay();
            hideEmptyState();
            hideNoMoreResults();
            showInitialLoadingIndicator(true);
            setSearchButtonLoading(true);
        } else {
            isLoadingMore = true;
            showInfiniteScrollLoader();
        }

        try {
            if (isNewSearch) {
                if (searchInputs.aiSearchEnabled) {
                    displayResultsCount('AI 검색식 생성 중...');
                    const aiSearchData = await generateAiSearchQuery({
                        question: searchInputs.rawKeywords,
                        startDate: searchInputs.startDate,
                        endDate: searchInputs.endDate,
                        journals: searchInputs.journalNames
                    });

                    searchInputs = {
                        ...searchInputs,
                        keywords: aiSearchData.pubmedQuery,
                        aiSearch: {
                            enabled: true,
                            question: searchInputs.rawKeywords,
                            pubmedQuery: aiSearchData.pubmedQuery,
                            concepts: aiSearchData.concepts || [],
                            explanation: aiSearchData.explanation || '',
                            confidence: aiSearchData.confidence || 'medium',
                            provider: aiSearchData.provider || '',
                            model: aiSearchData.model || ''
                        }
                    };
                }

                currentSearchQuery = searchInputs;
                if (searchContextElement) {
                    searchContextElement.textContent = buildSearchContextText(currentSearchQuery);
                }
            }

            const { articles, totalResults } = await searchNCBI({
                ...currentSearchQuery,
                retstart: currentRetstart,
                retmax: CONFIG.articlesPerPage
            });

            // UTC 기준의 새로운 날짜 필터링 함수로 최종 필터링
            const filteredArticles = filterArticlesByDate(articles, currentSearchQuery.startDate, currentSearchQuery.endDate);

            const { availableArticles, unavailableArticles } = splitArticlesByAbstract(filteredArticles);
            if (unavailableArticles.length > 0) {
                deferredNoAbstractArticles.push(...unavailableArticles);
            }

            let articlesToDisplay = availableArticles;
            let aiRankingApplied = false;
            if (currentSearchQuery.aiSearch?.enabled && availableArticles.length > 0) {
                try {
                    if (isNewSearch) {
                        displayResultsCount('AI 관련도 정렬 중...');
                    }
                    articlesToDisplay = await rankAiSearchResults({
                        question: currentSearchQuery.aiSearch.question,
                        articles: availableArticles
                    });
                    aiRankingApplied = true;
                } catch (rankError) {
                    console.error('AI relevance ranking failed:', rankError);
                    displayGlobalError(`AI 관련도 정렬 실패: ${rankError.message || '알 수 없는 오류'} PubMed 검색 순서로 표시합니다.`);
                }
            }

            if (isNewSearch) {
                const resultMessage = currentSearchQuery.aiSearch?.enabled && aiRankingApplied
                    ? `총 ${totalResults}개의 후보 논문을 찾았습니다. AI 관련도순으로 정렬했습니다.`
                    : `총 ${totalResults}개의 논문을 찾았습니다.`;
                displayResultsCount(resultMessage);
                displayArticles(articlesToDisplay, articlesListElement, true);
            } else {
                appendArticles(articlesToDisplay, articlesListElement);
            }

            // 페이징 업데이트
            currentRetstart += articles.length;

            // 더 이상 결과가 없는지 확인
            if (articles.length === 0 || articles.length < CONFIG.articlesPerPage || currentRetstart >= totalResults) {
                allArticlesLoaded = true;
                hasMore = false;

                if (deferredNoAbstractArticles.length > 0) {
                    appendArticles(deferredNoAbstractArticles, articlesListElement);
                    deferredNoAbstractArticles = [];
                }

                // 필터링 후 전체 표시된 논문 수가 0이 아닌 경우에만 메시지 표시
                const totalDisplayed = articlesListElement.querySelectorAll('.article-card').length;
                if (totalDisplayed > 0) {
                    showNoMoreResults();
                } else {
                    hideNoMoreResults();
                    showEmptyState('검색 결과 없음', '조건에 맞는 PubMed 논문을 찾지 못했습니다.');
                }
            }
        } catch (error) {
            console.error('Search failed:', error);
            let userErrorMessage = '논문 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

            if (error.message) {
                if (error.message.includes("NCBI ESearch API error") || error.message.includes("NCBI EFetch API error")) {
                    userErrorMessage = `PubMed API 통신 중 오류가 발생했습니다.`;
                } else if (error.message.includes("Network error") || error.message.includes("네트워크")) {
                    userErrorMessage = "네트워크 오류로 PubMed API에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.";
                } else {
                    userErrorMessage = error.message;
                }
            }

            displayGlobalError(userErrorMessage);
            if (isNewSearch) {
                displayResultsCount('');
                allArticlesLoaded = true;
                showEmptyState('검색 실패', userErrorMessage);
            }
        } finally {
            isLoadingMore = false;
            if (isNewSearch) {
                showInitialLoadingIndicator(false);
                setSearchButtonLoading(false);
            } else {
                hideInfiniteScrollLoader();
            }
        }
        return true;
    }

    // 검색 버튼 상태 관리 함수들
    function setSearchButtonLoading(loading) {
        searchButton.disabled = loading;
        if (searchButtonText) searchButtonText.classList.toggle('hidden', loading);
        if (searchButtonIcon) searchButtonIcon.classList.toggle('hidden', loading);
        if (searchButtonSpinner) searchButtonSpinner.style.display = loading ? 'inline-block' : 'none';
    }

    function resetSearchButton() {
        searchButton.disabled = false;
        if (searchButtonText) searchButtonText.classList.remove('hidden');
        if (searchButtonIcon) searchButtonIcon.classList.remove('hidden');
        if (searchButtonSpinner) searchButtonSpinner.style.display = 'none';
    }
}

// 날짜 필드 초기화
function initDateFields(startDateInput, endDateInput) {
    // 현재 날짜 정보
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);

    // YYYY-MM 형식으로 변환
    const formatYearMonth = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    // 기본값 설정
    startDateInput.value = formatYearMonth(lastYear);
    endDateInput.value = formatYearMonth(today);

    // 최대값: 오늘로부터 5년 후까지 허용
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 5);
    const maxDate = formatYearMonth(maxFutureDate);
    startDateInput.max = maxDate;
    endDateInput.max = maxDate;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function formatYearMonth(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function setDateRangeMonths(startDateInput, endDateInput, months) {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - Math.max(months - 1, 0), 1);

    startDateInput.value = formatYearMonth(startDate);
    endDateInput.value = formatYearMonth(endDate);
}

function getJournalPubMedTerms(journal) {
    const terms = Array.isArray(journal.pubmedTerms) && journal.pubmedTerms.length > 0
        ? journal.pubmedTerms
        : [journal.abbr || journal.name];

    return Array.from(new Set(
        terms
            .map(term => String(term || '').trim())
            .filter(Boolean)
    ));
}

function applyJournalMetadata(input, journal) {
    if (!input) {
        return;
    }

    input.dataset.journalName = journal.abbr || journal.name;
    input.dataset.journalTerms = JSON.stringify(getJournalPubMedTerms(journal));
}

function readJournalTerms(checkbox) {
    try {
        const parsedTerms = JSON.parse(checkbox.getAttribute('data-journal-terms') || '[]');
        if (Array.isArray(parsedTerms)) {
            const terms = parsedTerms.map(term => String(term || '').trim()).filter(Boolean);
            if (terms.length > 0) {
                return terms;
            }
        }
    } catch {
        // 아래 단일 저널명 fallback을 사용합니다.
    }

    const fallbackTerm = checkbox.getAttribute('data-journal-name');
    return fallbackTerm ? [fallbackTerm] : [];
}

function getSelectedJournalSearchTerms(container) {
    return Array.from(container.querySelectorAll('.journal-checkbox:checked'))
        .map(readJournalTerms)
        .filter(terms => terms.length > 0);
}

function getAiSearchPreference() {
    try {
        return window.localStorage.getItem(AI_SEARCH_MODE_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function setAiSearchPreference(enabled) {
    try {
        window.localStorage.setItem(AI_SEARCH_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // localStorage가 막힌 환경에서는 현재 세션의 체크 상태만 사용합니다.
    }
}

function initAiSearchMode(toggle, keywordsInput) {
    if (!toggle) {
        return;
    }

    toggle.checked = getAiSearchPreference();
    applyAiSearchModeState(toggle, keywordsInput);
}

function applyAiSearchModeState(toggle, keywordsInput) {
    if (!toggle || !keywordsInput) {
        return;
    }

    keywordsInput.placeholder = toggle.checked
        ? '예: shoulder instability에서 glenoid bony structure가 stability에 미치는 영향'
        : 'hip arthroplasty';
}

function getSelectedJournalNames(container) {
    return Array.from(container.querySelectorAll('.journal-checkbox:checked'))
        .map(checkbox => checkbox.closest('.journal-row')?.querySelector('label')?.textContent?.trim() || checkbox.getAttribute('data-journal-name'))
        .filter(Boolean);
}

function updateSelectedJournalSummary(container, countElement, summaryElement, clearButton) {
    const selectedJournalNames = getSelectedJournalNames(container);
    const count = selectedJournalNames.length;

    if (countElement) {
        countElement.textContent = String(count);
    }

    if (summaryElement) {
        if (count === 0) {
            summaryElement.textContent = '선택된 저널 없음';
        } else if (count <= 2) {
            summaryElement.textContent = selectedJournalNames.join(', ');
        } else {
            summaryElement.textContent = `${selectedJournalNames.slice(0, 2).join(', ')} 외 ${count - 2}개`;
        }
    }

    if (clearButton) {
        clearButton.disabled = count === 0;
    }
}

function clearJournalSelection(container) {
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    });
}

function buildSearchContextText(searchQuery) {
    const dateText = searchQuery.startDate
        ? `${searchQuery.startDate} ~ ${searchQuery.endDate}`
        : `전체 기간 ~ ${searchQuery.endDate}`;
    const journalText = `${searchQuery.journals.length}개 저널`;
    if (searchQuery.aiSearch?.enabled) {
        const conceptText = searchQuery.aiSearch.concepts?.length
            ? ` · 핵심: ${searchQuery.aiSearch.concepts.slice(0, 4).join(', ')}`
            : '';
        return `${dateText} · ${journalText} · AI 검색: ${searchQuery.aiSearch.question}${conceptText} · PubMed식: ${searchQuery.aiSearch.pubmedQuery}`;
    }

    const keywordText = searchQuery.keywords ? ` · 키워드: ${searchQuery.keywords}` : '';
    return `${dateText} · ${journalText}${keywordText}`;
}

// 저널 필터 UI 설정
function setupJournalFilters(container) {
    const expandFirstCategory = !window.matchMedia('(max-width: 920px)').matches;

    // 저널 카테고리 생성
    journalCategories.forEach((category, categoryIndex) => {
        const isInitiallyExpanded = expandFirstCategory && categoryIndex === 0;
        const categoryElement = document.createElement('div');
        categoryElement.className = 'journal-category';

        // 카테고리 토글 버튼 생성
        const categoryToggleButton = document.createElement('button');
        categoryToggleButton.className = `category-toggle${isInitiallyExpanded ? ' expanded' : ''}`;
        categoryToggleButton.innerHTML = `
            <div class="flex items-center">
                <input type="checkbox" id="select-all-${category.id}" class="select-all-category" data-category-id="${category.id}">
                <label for="select-all-${category.id}" class="flex-grow font-bold">${category.name}</label>
            </div>
            <i data-lucide="${isInitiallyExpanded ? 'chevron-up' : 'chevron-down'}" class="lucide-icon"></i>
        `;

        categoryElement.appendChild(categoryToggleButton);

        // 카테고리 콘텐츠 컨테이너 생성
        const categoryContent = document.createElement('div');
        categoryContent.className = isInitiallyExpanded ? 'category-content' : 'category-content hidden';
        categoryElement.appendChild(categoryContent);

        // 서브 카테고리가 있는 경우
        if (category.subCategories) {
            const subCategoriesContainer = document.createElement('div');
            subCategoriesContainer.className = 'subcategories-container';

            // 각 서브 카테고리 생성
            category.subCategories.forEach(subCategory => {
                const subCategoryElement = document.createElement('div');
                subCategoryElement.className = 'subcategory';

                // 서브 카테고리 토글 버튼
                const subCategoryToggleButton = document.createElement('button');
                subCategoryToggleButton.className = 'subcategory-toggle';
                subCategoryToggleButton.innerHTML = `
                    <div class="flex items-center">
                        <input type="checkbox" id="select-all-${subCategory.id}" class="select-all-subcategory" data-subcategory-id="${subCategory.id}">
                        <label for="select-all-${subCategory.id}" class="flex-grow font-semibold text-sm">${subCategory.name}</label>
                    </div>
                    <i data-lucide="chevron-down" class="lucide-icon"></i>
                `;

                subCategoryElement.appendChild(subCategoryToggleButton);

                // 서브 카테고리의 저널 목록
                const journalsList = document.createElement('div');
                journalsList.className = 'subcategory-journals-list hidden';

                subCategory.journals.forEach(journal => {
                    const journalItem = document.createElement('div');
                    journalItem.className = 'journal-row';
                    journalItem.innerHTML = `
                        <input type="checkbox" id="${journal.id}" class="journal-checkbox"
                            data-category-id="${category.id}"
                            data-subcategory-id="${subCategory.id}">
                        <label for="${journal.id}">${journal.name}</label>
                    `;
                    applyJournalMetadata(journalItem.querySelector('.journal-checkbox'), journal);
                    journalsList.appendChild(journalItem);
                });

                subCategoryElement.appendChild(journalsList);
                subCategoriesContainer.appendChild(subCategoryElement);

                // 서브 카테고리 토글 이벤트
                const subToggleButton = subCategoryElement.querySelector('.subcategory-toggle');
                const subJournalsList = subCategoryElement.querySelector('.subcategory-journals-list');
                const subIcon = subToggleButton.querySelector('.lucide-icon');

                subToggleButton.addEventListener('click', (e) => {
                    if (e.target.type === 'checkbox' || e.target.closest('label')?.querySelector('input[type="checkbox"]')) {
                        return;
                    }
                    e.preventDefault();
                    subJournalsList.classList.toggle('hidden');
                    subToggleButton.classList.toggle('expanded');
                    subIcon.setAttribute('data-lucide', subJournalsList.classList.contains('hidden') ? 'chevron-down' : 'chevron-up');
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                });

                // 서브 카테고리 체크박스 이벤트
                const selectAllSubcategoryCheckbox = subCategoryElement.querySelector('.select-all-subcategory');
                const subcategoryJournalCheckboxes = subCategoryElement.querySelectorAll('.journal-checkbox');

                selectAllSubcategoryCheckbox.addEventListener('change', () => {
                    const isChecked = selectAllSubcategoryCheckbox.checked;
                    subcategoryJournalCheckboxes.forEach(checkbox => {
                        checkbox.checked = isChecked;
                    });

                    // 모든 서브카테고리 체크박스 상태 확인하여 메인 카테고리 체크박스 업데이트
                    updateCategoryCheckboxState(category, categoryElement);
                });

                // 저널 체크박스 이벤트
                subcategoryJournalCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', () => {
                        updateParentCheckbox(selectAllSubcategoryCheckbox, subcategoryJournalCheckboxes);
                        updateCategoryCheckboxState(category, categoryElement);
                    });
                });
            });

            categoryContent.appendChild(subCategoriesContainer);
        } else {
            // 서브 카테고리가 없는 경우 - 일반 저널 목록
            const journalsList = document.createElement('div');
            journalsList.className = 'journals-list';

            category.journals.forEach(journal => {
                const journalItem = document.createElement('div');
                journalItem.className = 'journal-row';
                journalItem.innerHTML = `
                    <input type="checkbox" id="${journal.id}" class="journal-checkbox"
                        data-category-id="${category.id}">
                    <label for="${journal.id}">${journal.name}</label>
                `;
                applyJournalMetadata(journalItem.querySelector('.journal-checkbox'), journal);
                journalsList.appendChild(journalItem);
            });

            categoryContent.appendChild(journalsList);

            // 일반 카테고리 체크박스 이벤트
            const selectAllCategoryCheckbox = categoryElement.querySelector('.select-all-category');
            const journalCheckboxes = journalsList.querySelectorAll('.journal-checkbox');

            selectAllCategoryCheckbox.addEventListener('change', () => {
                const isChecked = selectAllCategoryCheckbox.checked;
                journalCheckboxes.forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
            });

            journalCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    updateParentCheckbox(selectAllCategoryCheckbox, journalCheckboxes);
                });
            });
        }

        container.appendChild(categoryElement);

        // 카테고리 토글 이벤트
        const toggleButton = categoryElement.querySelector('.category-toggle');
        const contentElement = categoryElement.querySelector('.category-content');
        const icon = toggleButton.querySelector('.lucide-icon');

        toggleButton.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox' || e.target.closest('label')?.querySelector('input[type="checkbox"]')) {
                return;
            }
            e.preventDefault();
            contentElement.classList.toggle('hidden');
            toggleButton.classList.toggle('expanded');
            icon.setAttribute('data-lucide', contentElement.classList.contains('hidden') ? 'chevron-down' : 'chevron-up');
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });

        // 카테고리 전체 선택/해제 이벤트 핸들러 추가
        categoryToggleButton.querySelector('.select-all-category').addEventListener('change', (e) => {
            const isChecked = e.target.checked;

            // 서브 카테고리가 있는 경우
            if (category.subCategories) {
                // 모든 서브카테고리 체크박스 상태 변경
                const subCategoryCheckboxes = categoryElement.querySelectorAll('.select-all-subcategory');
                subCategoryCheckboxes.forEach(checkbox => {
                    checkbox.checked = isChecked;
                    // 각 서브카테고리의 이벤트 핸들러 수동 트리거
                    const event = new Event('change');
                    checkbox.dispatchEvent(event);
                });

                // 모든 저널 체크박스 상태 변경
                const allJournalCheckboxes = categoryElement.querySelectorAll('.journal-checkbox');
                allJournalCheckboxes.forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
            }
        });
    });

    // 아이콘 생성
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// 부모 체크박스 상태 업데이트
function updateParentCheckbox(parentCheckbox, childCheckboxes) {
    const allChecked = Array.from(childCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(childCheckboxes).some(cb => cb.checked);

    parentCheckbox.checked = allChecked;
    parentCheckbox.indeterminate = someChecked && !allChecked;
}

// 카테고리 체크박스 상태 업데이트 - 모든 서브카테고리의 상태를 확인
function updateCategoryCheckboxState(category, categoryElement) {
    if (!category.subCategories) return;

    const allSubcategoryCheckboxes = categoryElement.querySelectorAll('.select-all-subcategory');
    const mainCategoryCheckbox = categoryElement.querySelector('.select-all-category');

    // 모든 저널 체크박스 상태 확인
    const allJournalCheckboxes = categoryElement.querySelectorAll('.journal-checkbox');
    const allJournalCheckboxesChecked = Array.from(allJournalCheckboxes).every(cb => cb.checked);
    const someJournalCheckboxesChecked = Array.from(allJournalCheckboxes).some(cb => cb.checked);
    const someSubcategoryCheckboxesIndeterminate = Array.from(allSubcategoryCheckboxes).some(cb => cb.indeterminate);

    // 메인 카테고리 체크박스 상태 업데이트
    mainCategoryCheckbox.checked = allJournalCheckboxesChecked;
    mainCategoryCheckbox.indeterminate = (someJournalCheckboxesChecked && !allJournalCheckboxesChecked) ||
        someSubcategoryCheckboxesIndeterminate;
}

// 무한 스크롤 설정
function setupInfiniteScroll(sentinel, container, callback) {
    // 맥북(데스크탑)과 아이폰(모바일) 모두 window 스크롤 기준으로 동작하도록 root를 null로 고정
    const observerOptions = {
        root: null, // 항상 window 기준
        rootMargin: '0px 0px 400px 0px',
        threshold: 0.01
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                callback();
            }
        });
    }, observerOptions);

    if (sentinel) {
        observer.observe(sentinel);
    }
}

// 검색 버튼 상태 업데이트
function updateSearchButtonState(startDateInput, endDateInput, journalFilterContainer, searchButton, options = {}) {
    const endDate = endDateInput.value;
    const anyJournalSelected = Array.from(journalFilterContainer.querySelectorAll('.journal-checkbox')).some(cb => cb.checked);
    const keywordRequired = Boolean(options.requireKeywords);
    const keywordReady = !keywordRequired || Boolean(options.keywordsInput?.value?.trim());

    const isValid = endDate && anyJournalSelected && keywordReady;
    searchButton.disabled = !isValid;

    return isValid;
}

// 검색 쿼리 유효성 검사 및 구성
function validateAndBuildSearchQuery(startDateInput, endDateInput, journalFilterContainer, keywordsInput, options = {}) {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const keywords = keywordsInput ? keywordsInput.value.trim() : '';
    const aiSearchEnabled = Boolean(options.aiSearchEnabled);

    if (!endDate) {
        displayGlobalError('검색 종료일을 입력해주세요.');
        return null;
    }

    // 날짜 유효성 검사 추가
    const startDateObj = startDate ? new Date(startDate + '-01') : null;
    const endDateObj = new Date(endDate + '-01');

    if (startDateObj && startDateObj > endDateObj) {
        displayGlobalError('시작일이 종료일보다 늦을 수 없습니다.');
        return null;
    }

    // 선택된 저널 목록 가져오기 - 서브카테고리 구조 지원
    const selectedJournals = getSelectedJournalSearchTerms(journalFilterContainer);
    const selectedJournalNames = getSelectedJournalNames(journalFilterContainer);

    if (selectedJournals.length === 0) {
        displayGlobalError('적어도 하나의 저널을 선택해주세요.');
        return null;
    }

    if (aiSearchEnabled && !keywords) {
        displayGlobalError('AI 검색 질문을 입력해주세요.');
        return null;
    }

    return {
        startDate,
        endDate,
        journals: selectedJournals,
        journalNames: selectedJournalNames,
        keywords,
        rawKeywords: keywords,
        aiSearchEnabled,
        aiSearch: {
            enabled: false
        }
    };
}

// 네트워크 상태 모니터링 및 사용자 피드백 개선
window.addEventListener('online', () => {
    clearGlobalError();
});

window.addEventListener('offline', () => {
    displayGlobalError('인터넷 연결이 끊어졌습니다. 연결을 확인해주세요.');
});

// 전역 에러 처리
window.addEventListener('error', (event) => {
    console.error('전역 에러 발생:', event.error);

    // 사용자에게 표시할 에러가 API 관련인 경우 특별 처리
    if (event.error && event.error.message) {
        const errorMessage = event.error.message;
        if (errorMessage.includes('API') || errorMessage.includes('fetch')) {
            displayGlobalError('서비스 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
    }
});

// 타임존 문제 해결을 위한 UTC 기반 날짜 필터링 함수
function filterArticlesByDate(articles, startDateStr, endDateStr) {
    if (!endDateStr) return articles;

    try {
        // YYYY-MM 형식을 파싱
        const [endYear, endMonth] = endDateStr.split('-').map(Number);
        const [startYear, startMonth] = startDateStr ? startDateStr.split('-').map(Number) : [0, 0];

        return articles.filter(article => {
            if (!article.publicationDate) return false;

            // publicationDate를 파싱 (YYYY-MM-DD, YYYY-MM, YYYY 형식 모두 지원)
            const dateParts = article.publicationDate.split('-');
            const pubYear = parseInt(dateParts[0]);
            const pubMonth = dateParts[1] ? parseInt(dateParts[1]) : 1;

            if (!pubYear || isNaN(pubYear)) return false;

            // 연도와 월을 비교
            const pubYearMonth = pubYear * 100 + pubMonth;
            const startYearMonth = startDateStr ? startYear * 100 + startMonth : 0;
            const endYearMonth = endYear * 100 + endMonth;

            return pubYearMonth >= startYearMonth && pubYearMonth <= endYearMonth;
        });
    } catch (e) {
        console.error("날짜 필터링 중 오류 발생:", e);
        return articles;
    }
}

function hasAvailableAbstract(article) {
    const abstract = String(article?.abstract || '').trim();
    return Boolean(
        abstract &&
        abstract !== 'No abstract information.' &&
        abstract !== '초록 정보 없음.'
    );
}

function splitArticlesByAbstract(articles) {
    return articles.reduce((groups, article) => {
        if (hasAvailableAbstract(article)) {
            groups.availableArticles.push(article);
        } else {
            groups.unavailableArticles.push(article);
        }
        return groups;
    }, {
        availableArticles: [],
        unavailableArticles: []
    });
}
