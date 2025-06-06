import { searchNCBI, getOpenAISummary } from './api_service.js';
import { displayArticles, showInitialLoadingIndicator, clearResultsDisplay, displayResultsCount, displayGlobalError, clearGlobalError, appendArticles, showInfiniteScrollLoader, hideInfiniteScrollLoader, showNoMoreResults, hideNoMoreResults } from './ui_manager.js';
import { journalCategories } from './journal_data.js';

// 설정 값
const CONFIG = {
    articlesPerPage: 15,
    searchDelay: 300 // ms
};

// 서비스 워커 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('서비스 워커가 등록되었습니다:', registration.scope);
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

    // 요약 버튼 이벤트 리스너 (동적 생성 카드 대응)
    document.addEventListener('click', (event) => {
        if (event.target.matches('.summary-button')) {
            const button = event.target;
            const articleCard = button.closest('.article-card');
            const abstractElement = articleCard.querySelector('.abstract-content');
            const abstractText = abstractElement.textContent;
            
            handleSummaryClick(button, abstractText);
        }
    });
});

// 설정 관리 초기화 함수
function initSettings() {
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const apiKeyStatus = document.getElementById('api-key-status');

    if (!apiKeyInput || !saveApiKeyBtn || !apiKeyStatus) {
        console.warn('설정 UI 요소를 찾을 수 없습니다.');
        return;
    }

    // 페이지 로드 시 저장된 API 키 상태 확인
    updateApiKeyStatus();

    // API 키 저장 버튼 이벤트
    saveApiKeyBtn.addEventListener('click', handleApiKeySave);

    // Enter 키로 저장 가능하도록
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleApiKeySave();
        }
    });

    // API 키 저장 처리 함수
    function handleApiKeySave() {
        const apiKey = apiKeyInput.value.trim();
        
        if (apiKey) {
            // API 키 형식 검증
            if (apiKey.startsWith('sk-') && apiKey.length > 20) {
                localStorage.setItem('openai_api_key', apiKey);
                showApiKeyStatus('✓ API 키가 성공적으로 저장되었습니다!', 'success');
                apiKeyInput.value = ''; // 보안을 위해 입력 필드 비우기
                
                // 2초 후 일반 상태 메시지로 변경
                setTimeout(() => { 
                    updateApiKeyStatus();
                }, 2000);
            } else {
                showApiKeyStatus('⚠ 올바른 API 키 형식이 아닙니다. (sk-로 시작해야 함)', 'error');
            }
        } else {
            // 빈 값인 경우 API 키 삭제
            localStorage.removeItem('openai_api_key');
            showApiKeyStatus('✓ API 키가 삭제되었습니다.', 'info');
            
            setTimeout(() => { 
                updateApiKeyStatus();
            }, 2000);
        }
    }

    // API 키 상태 업데이트 함수
    function updateApiKeyStatus() {
        const savedApiKey = localStorage.getItem('openai_api_key');
        if (savedApiKey && savedApiKey.trim()) {
            apiKeyInput.value = savedApiKey; // 저장된 키를 입력 필드에 표시
            showApiKeyStatus('✓ API 키가 저장되어 있습니다.', 'success');
        } else {
            apiKeyInput.value = '';
            showApiKeyStatus('⚠ API 키가 설정되지 않았습니다.', 'warning');
        }
    }

    // API 키 상태 메시지 표시 함수
    function showApiKeyStatus(message, type) {
        apiKeyStatus.textContent = message;
        
        // 기존 색상 관련 클래스 모두 제거
        apiKeyStatus.classList.remove('text-green-600', 'text-red-600', 'text-orange-600', 'text-gray-600');
        
        // 타입에 따른 클래스 추가
        switch (type) {
            case 'success':
                apiKeyStatus.classList.add('text-green-600');
                break;
            case 'error':
                apiKeyStatus.classList.add('text-red-600');
                break;
            case 'warning':
                apiKeyStatus.classList.add('text-orange-600');
                break;
            case 'info':
            default:
                apiKeyStatus.classList.add('text-gray-600');
        }
    }
}

// 요약 생성 핸들러
async function handleSummaryClick(button, abstractText) {
    const summaryContainer = button.parentElement.querySelector('.summary-text-content');
    
    // 이미 요약이 있는 경우 토글
    if (summaryContainer.textContent && !summaryContainer.classList.contains('summary-error')) {
        summaryContainer.classList.toggle('hidden');
        return;
    }

    // API 키 확인 및 검증
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey || !apiKey.trim()) {
        showSummaryError(summaryContainer, 'API 키가 설정되지 않았습니다. 설정 탭에서 OpenAI API 키를 입력해주세요.');
        return;
    }

    if (!apiKey.startsWith('sk-')) {
        showSummaryError(summaryContainer, 'API 키 형식이 올바르지 않습니다. 설정 탭에서 올바른 API 키를 입력해주세요.');
        return;
    }
    
    // 요약 생성 시작
    button.disabled = true;
    button.textContent = '요약 생성 중...';
    summaryContainer.textContent = '';
    summaryContainer.classList.remove('hidden', 'summary-error');
    
    try {
        const summary = await getOpenAISummary(abstractText, apiKey); // API 키 전달
        summaryContainer.textContent = summary;
        summaryContainer.classList.remove('summary-error');
    } catch (error) {
        console.error('Summary error:', error);
        let errorMessage = `요약을 생성하지 못했습니다: ${error.message || '알 수 없는 오류'}`;
        
        // API 키 관련 오류인 경우 특별 처리
        if (error.message && (
            error.message.includes('API 키') || 
            error.message.includes('401') || 
            error.message.includes('403') ||
            error.message.includes('유효하지 않은')
        )) {
            errorMessage = `${error.message} 설정 탭에서 API 키를 확인해주세요.`;
        }
        
        showSummaryError(summaryContainer, errorMessage);
    } finally {
        button.disabled = false;
        button.textContent = '요약 보기';
    }
}

// 요약 에러 표시 함수
function showSummaryError(container, message) {
    container.textContent = message;
    container.classList.add('summary-error');
    container.classList.remove('hidden');
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
    const journalFilterContainer = document.getElementById('journal-filter-container');
    const resultsPanel = document.getElementById('results-panel');
    const articlesListElement = document.getElementById('articles-list');
    const scrollSentinel = document.getElementById('scroll-sentinel');

    // 필수 요소 존재 확인
    if (!searchButton || !startDateInput || !endDateInput || !journalFilterContainer) {
        console.error('필수 UI 요소를 찾을 수 없습니다.');
        return;
    }

    // 검색 상태 관리 변수
    let currentSearchQuery = null;
    let currentRetstart = 0;
    let totalResultsFound = 0;
    let isLoadingMore = false;
    let allArticlesLoaded = false;

    // 날짜 입력 필드 초기화
    initDateFields(startDateInput, endDateInput);
    
    // 검색 버튼 클릭 이벤트
    searchButton.addEventListener('click', () => performSearch(true));
    
    // 저널 필터 UI 설정
    setupJournalFilters(journalFilterContainer);
    
    // 무한 스크롤 설정
    if (scrollSentinel && resultsPanel) {
        setupInfiniteScroll(scrollSentinel, resultsPanel, () => {
            if (!isLoadingMore && !allArticlesLoaded && currentSearchQuery) {
                isLoadingMore = true;
                showInfiniteScrollLoader();
                performSearch(false);
            }
        });
    }

    // 폼 입력 유효성 실시간 검사 및 검색 버튼 상태 업데이트
    const formElements = [startDateInput, endDateInput, keywordsInput].filter(Boolean);
    formElements.forEach(el => {
        el.addEventListener('input', () => updateSearchButtonState(startDateInput, endDateInput, journalFilterContainer, searchButton));
    });

    // 저널 체크박스 변경 시 검색 버튼 상태 업데이트
    const observer = new MutationObserver(() => {
        updateSearchButtonState(startDateInput, endDateInput, journalFilterContainer, searchButton);
    });
    observer.observe(journalFilterContainer, { 
        subtree: true, 
        attributes: true,
        attributeFilter: ['checked'] 
    });

    // 검색 수행 함수
    async function performSearch(isNewSearch) {
        // 검색이 진행 중이거나 모든 결과를 이미 로드한 경우 중단
        if ((isLoadingMore && !isNewSearch) || (allArticlesLoaded && !isNewSearch)) {
            isLoadingMore = false;
            hideInfiniteScrollLoader();
            return false;
        }

        // 새 검색인 경우 UI 초기화 및 검색 쿼리 구성
        if (isNewSearch) {
            const searchInputs = validateAndBuildSearchQuery(startDateInput, endDateInput, journalFilterContainer, keywordsInput);
            if (!searchInputs) {
                resetSearchButton();
                return false;
            }
            
            currentSearchQuery = searchInputs;
            currentRetstart = 0;
            allArticlesLoaded = false;
            
            // UI 업데이트
            clearGlobalError();
            clearResultsDisplay();
            showInitialLoadingIndicator(true);
            setSearchButtonLoading(true);
        }

        try {
            const { articles, totalResults } = await searchNCBI({
                ...currentSearchQuery,
                retstart: currentRetstart,
                retmax: CONFIG.articlesPerPage
            });

            if (isNewSearch) {
                totalResultsFound = totalResults; 
                if (articles.length === 0 && totalResultsFound === 0) {
                    displayResultsCount('검색 조건에 맞는 논문이 없습니다.');
                } else {
                    displayResultsCount(`${totalResultsFound}개의 논문을 찾았습니다.`);
                }
                displayArticles(articles, articlesListElement, true); 
            } else {
                appendArticles(articles, articlesListElement); 
            }
            
            currentRetstart += articles.length;
            allArticlesLoaded = totalResultsFound === 0 || articles.length < CONFIG.articlesPerPage || currentRetstart >= totalResultsFound;
            
            if (allArticlesLoaded) {
                if (totalResultsFound > 0 && articlesListElement?.children.length > 0) {
                    showNoMoreResults();
                } else {
                    hideNoMoreResults();
                }
            } else {
                hideNoMoreResults(); 
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
    
    // 타입 설정 (Safari 호환성을 위해)
    startDateInput.type = 'month';
    endDateInput.type = 'month';
    
    // 클릭 이벤트 추가 (모바일 Safari 대응)
    startDateInput.addEventListener('click', function() {
        this.type = 'month';
        this.focus();
    });
    
    endDateInput.addEventListener('click', function() {
        this.type = 'month';
        this.focus();
    });
    
    // 최대값 설정
    const maxDate = formatYearMonth(today);
    startDateInput.max = maxDate;
    endDateInput.max = maxDate;
}

// 저널 필터 UI 설정
function setupJournalFilters(container) {
    // 저널 카테고리 생성
    journalCategories.forEach(category => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'mb-4 border border-[#CBBFB4] rounded-md';
        
        // 카테고리 토글 버튼 생성
        const categoryToggleButton = document.createElement('button');
        categoryToggleButton.className = 'category-toggle w-full flex justify-between items-center text-left p-2 rounded-t-md bg-[#DCD0C0] hover:bg-[#CBBFB4] transition';
        categoryToggleButton.innerHTML = `
            <div class="flex items-center">
                <input type="checkbox" id="select-all-${category.id}" class="select-all-category h-4 w-4 form-checkbox transition rounded border-[#654321] border-2 text-[#654321] mr-2" data-category-id="${category.id}">
                <label for="select-all-${category.id}" class="flex-grow font-bold">${category.name}</label>
            </div>
            <i data-lucide="chevron-down" class="lucide-icon w-5 h-5"></i>
        `;
        
        categoryElement.appendChild(categoryToggleButton);
        
        // 카테고리 콘텐츠 컨테이너 생성
        const categoryContent = document.createElement('div');
        categoryContent.className = 'category-content hidden p-2';
        categoryElement.appendChild(categoryContent);
        
        // 서브 카테고리가 있는 경우
        if (category.subCategories) {
            const subCategoriesContainer = document.createElement('div');
            subCategoriesContainer.className = 'subcategories-container space-y-2';
            
            // 각 서브 카테고리 생성
            category.subCategories.forEach(subCategory => {
                const subCategoryElement = document.createElement('div');
                subCategoryElement.className = 'subcategory mb-2';
                
                // 서브 카테고리 토글 버튼
                const subCategoryToggleButton = document.createElement('button');
                subCategoryToggleButton.className = 'subcategory-toggle w-full flex justify-between items-center text-left p-1.5 bg-[#DCD0C0]/60 hover:bg-[#CBBFB4]/70 rounded-md';
                subCategoryToggleButton.innerHTML = `
                    <div class="flex items-center">
                        <input type="checkbox" id="select-all-${subCategory.id}" class="select-all-subcategory h-4 w-4 form-checkbox transition rounded border-[#654321] border-2 text-[#654321] mr-2" data-subcategory-id="${subCategory.id}">
                        <label for="select-all-${subCategory.id}" class="flex-grow font-semibold text-sm">${subCategory.name}</label>
                    </div>
                    <i data-lucide="chevron-down" class="lucide-icon w-4 h-4"></i>
                `;
                
                subCategoryElement.appendChild(subCategoryToggleButton);
                
                // 서브 카테고리의 저널 목록
                const journalsList = document.createElement('div');
                journalsList.className = 'subcategory-journals-list hidden pl-3 mt-1 space-y-1';
                
                subCategory.journals.forEach(journal => {
                    const journalItem = document.createElement('div');
                    journalItem.className = 'flex items-center mt-1';
                    journalItem.innerHTML = `
                        <input type="checkbox" id="${journal.id}" class="journal-checkbox h-3.5 w-3.5 form-checkbox transition rounded border-[#654321] border-2 text-[#654321] mr-2" 
                            data-category-id="${category.id}" 
                            data-subcategory-id="${subCategory.id}" 
                            data-journal-name="${journal.abbr || journal.name}">
                        <label for="${journal.id}" class="text-xs text-[#654321]">${journal.name}</label>
                    `;
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
            journalsList.className = 'journals-list pl-2 space-y-1';
            
            category.journals.forEach(journal => {
                const journalItem = document.createElement('div');
                journalItem.className = 'flex items-center mt-1';
                journalItem.innerHTML = `
                    <input type="checkbox" id="${journal.id}" class="journal-checkbox h-4 w-4 form-checkbox transition rounded border-[#654321] border-2 text-[#654321] mr-2" 
                        data-category-id="${category.id}" 
                        data-journal-name="${journal.abbr || journal.name}">
                    <label for="${journal.id}" class="text-sm">${journal.name}</label>
                `;
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
                let observerRoot = null;
                if (window.matchMedia('(min-width: 768px)').matches && container) {
                    observerRoot = container;
                }
            
                const observerOptions = {
                    root: observerRoot,
                    rootMargin: '0px 0px 200px 0px', 
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
            function updateSearchButtonState(startDateInput, endDateInput, journalFilterContainer, searchButton) {
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;
                const anyJournalSelected = Array.from(journalFilterContainer.querySelectorAll('.journal-checkbox')).some(cb => cb.checked);
                
                const isValid = startDate && endDate && anyJournalSelected;
                searchButton.disabled = !isValid;
                
                return isValid;
            }
            
            // 검색 쿼리 유효성 검사 및 구성
            function validateAndBuildSearchQuery(startDateInput, endDateInput, journalFilterContainer, keywordsInput) {
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;
                const keywords = keywordsInput ? keywordsInput.value : '';
                
                if (!startDate || !endDate) {
                    displayGlobalError('검색 시작일과 종료일을 모두 입력해주세요.');
                    return null;
                }
                
                // 날짜 유효성 검사 추가
                const startDateObj = new Date(startDate + '-01');
                const endDateObj = new Date(endDate + '-01');
                
                if (startDateObj > endDateObj) {
                    displayGlobalError('시작일이 종료일보다 늦을 수 없습니다.');
                    return null;
                }
                
                // 선택된 저널 목록 가져오기 - 서브카테고리 구조 지원
                const selectedJournals = Array.from(journalFilterContainer.querySelectorAll('.journal-checkbox:checked')).map(
                    checkbox => checkbox.getAttribute('data-journal-name')
                );
                
                if (selectedJournals.length === 0) {
                    displayGlobalError('적어도 하나의 저널을 선택해주세요.');
                    return null;
                }
                
                return {
                    startDate,
                    endDate,
                    journals: selectedJournals,
                    keywords: keywords.trim()
                };
            }
            

            
            // 네트워크 상태 모니터링 및 사용자 피드백 개선
            window.addEventListener('online', () => {
                clearGlobalError();
                console.log('네트워크 연결이 복구되었습니다.');
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
            
            // 페이지 언로드 시 정리 작업
            window.addEventListener('beforeunload', () => {
                // 필요한 경우 정리 작업 수행
                console.log('페이지를 떠납니다.');
            });
            