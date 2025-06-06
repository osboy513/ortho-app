import { getOpenAISummary } from './summary_service.js';

const resultsCountElement = document.getElementById('results-count');
const errorMessageContainer = document.getElementById('error-message-container');
const initialLoadingIndicatorElement = document.getElementById('initial-loading-indicator');
const infiniteScrollLoaderElement = document.getElementById('infinite-scroll-loader');
const noMoreResultsElement = document.getElementById('no-more-results');


function createArticleCard(article) {
    const card = document.createElement('div');
    card.className = 'article-card p-4 sm:p-5 rounded-lg shadow-md border border-[#DCD0C0]';
    
    let abstractHtml = article.abstract;
    const isAbstractAvailable = article.abstract && article.abstract !== 'No abstract information.';
    
    if (!isAbstractAvailable) {
        abstractHtml = `<p class="text-sm text-gray-500 italic">초록 정보 없음.</p>`;
    } else {
        abstractHtml = `<div class="abstract-content text-sm text-[#654321]">${article.abstract}</div>
                        <button class="text-xs text-[#654321] hover:underline mt-1.5 expand-abstract-button">자세히 보기</button>`;
    }

    card.innerHTML = `
        <h3 class="text-md sm:text-lg font-semibold article-title mb-1.5">${article.title}</h3>
        <p class="text-xs text-gray-600 mb-0.5"><strong>저자:</strong> ${article.authors}</p>
        <p class="text-xs text-gray-600 mb-0.5"><strong>저널:</strong> ${article.journalName}</p>
        <p class="text-xs text-gray-600 mb-2"><strong>출간일:</strong> ${article.publicationDate || 'N/A'}</p>
        
        <div class="mb-2.5">
            <h4 class="text-xs font-semibold text-[#654321] mb-0.5">초록:</h4>
            <div class="abstract-text-container">${abstractHtml}</div>
        </div>

        <div>
            <h4 class="text-xs font-semibold text-[#654321] mb-1">AI 한 줄 요약:</h4>
            <button class="summary-button text-xs bg-[#654321] text-white hover:bg-[#8B4513] py-1 px-2.5 rounded-md transition duration-150 ease-in-out" data-pmid="${article.pmid}" ${!isAbstractAvailable ? 'disabled title="초록 정보가 없어 요약할 수 없습니다."' : ''}>
                <span class="button-text">요약 보기</span>
                <span class="button-spinner hidden w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1.5"></span>
            </button>
            <div class="summary-text-content mt-1.5 p-2 rounded-md bg-[#F0EBE4] text-xs text-[#654321]" style="display: none;">
                <!-- Summary will be loaded here -->
            </div>
        </div>
        <p class="mt-2.5 text-xs text-gray-500">PMID: <a href="https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/" target="_blank" class="text-[#654321] hover:underline">${article.pmid}</a></p>
    `;


    const expandButton = card.querySelector('.expand-abstract-button');
    const abstractContent = card.querySelector('.abstract-content');
    if (expandButton && abstractContent) {
        expandButton.addEventListener('click', () => {
            abstractContent.classList.toggle('expanded');
            expandButton.textContent = abstractContent.classList.contains('expanded') ? '간략히 보기' : '자세히 보기';
        });
    }


    const summaryButton = card.querySelector('.summary-button');
    const summaryTextContainer = card.querySelector('.summary-text-content');
    const summaryButtonText = summaryButton.querySelector('.button-text');
    const summaryButtonSpinner = summaryButton.querySelector('.button-spinner');

    summaryButton.addEventListener('click', async () => {
        if (summaryTextContainer.style.display !== 'none' && summaryTextContainer.innerHTML !== '' && !summaryTextContainer.dataset.error) { // Already loaded and visible
             summaryTextContainer.style.display = 'none'; // Hide if shown
             return;
        }
        
        // API 키 확인
        const apiKey = localStorage.getItem('openai_api_key');
        if (!apiKey || !apiKey.trim()) {
            summaryTextContainer.style.display = 'block';
            summaryTextContainer.innerHTML = `<p class="summary-error">API 키가 설정되지 않았습니다. 설정에서 OpenAI API 키를 입력해주세요.</p>`;
            summaryTextContainer.dataset.error = "true";
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            summaryTextContainer.style.display = 'block';
            summaryTextContainer.innerHTML = `<p class="summary-error">API 키 형식이 올바르지 않습니다. 설정에서 올바른 API 키를 입력해주세요.</p>`;
            summaryTextContainer.dataset.error = "true";
            return;
        }
        
        summaryButton.disabled = true;
        summaryButtonText.classList.add('hidden');
        summaryButtonSpinner.classList.remove('hidden');
        summaryTextContainer.style.display = 'block';
        summaryTextContainer.innerHTML = `<em class="text-gray-500">AI 요약 생성 중...</em>`;
        summaryTextContainer.dataset.error = "false";

        try {
            const summary = await getOpenAISummary(article.abstract, apiKey);
            summaryTextContainer.innerHTML = `<p>${summary}</p>`;
        } catch (error) {
            console.error(`Error fetching OpenAI summary for PMID ${article.pmid}:`, error);
            let errorMessage = `AI 요약 실패: ${error.message}`;
            
            // API 키 관련 오류인 경우 특별 처리
            if (error.message && (
                error.message.includes('API 키') || 
                error.message.includes('401') || 
                error.message.includes('403') ||
                error.message.includes('유효하지 않은')
            )) {
                errorMessage = `${error.message} 설정에서 API 키를 확인해주세요.`;
            }
            
            summaryTextContainer.innerHTML = `<p class="summary-error">${errorMessage}</p>`;
            summaryTextContainer.dataset.error = "true";
        } finally {
            summaryButton.disabled = false;
            summaryButtonText.classList.remove('hidden');
            summaryButtonSpinner.classList.add('hidden');
            if (typeof lucide !== 'undefined') {
                lucide.createIcons(); // In case icons were part of summary/error message
            }
        }
    });

    return card;
}

function displayArticles(articles, articlesListElement, isNewSearch) {
    if (isNewSearch) {
        articlesListElement.innerHTML = '';
    }
    articles.forEach(article => {
        const articleCard = createArticleCard(article);
        articlesListElement.appendChild(articleCard);
    });
    lucide.createIcons(); // Create icons for any new cards
}

function appendArticles(articles, articlesListElement) {
    displayArticles(articles, articlesListElement, false);
}

function showInitialLoadingIndicator(show) {
    if (initialLoadingIndicatorElement) {
        initialLoadingIndicatorElement.style.display = show ? 'flex' : 'none';
    }
}

function clearResultsDisplay(articlesListElement = document.getElementById('articles-list')) {
    if (articlesListElement) articlesListElement.innerHTML = '';
    if (resultsCountElement) resultsCountElement.textContent = '';
    clearGlobalError();
}

function displayResultsCount(message) {
    if (resultsCountElement) {
        resultsCountElement.textContent = message;
    }
}

function displayGlobalError(message) {
    if (errorMessageContainer) {
        errorMessageContainer.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative" role="alert">
            <div class="flex">
                <div class="py-1"><i data-lucide="alert-triangle" class="h-5 w-5 text-red-500 mr-3"></i></div>
                <div>
                    <p class="font-bold">오류</p>
                    <p class="text-sm">${message}</p>
                </div>
            </div>
        </div>`;
        lucide.createIcons(); 
    }
}

function clearGlobalError() {
    if (errorMessageContainer) {
        errorMessageContainer.innerHTML = '';
    }
}

function showInfiniteScrollLoader(show) {
    if (infiniteScrollLoaderElement) {
        infiniteScrollLoaderElement.style.display = show ? 'block' : 'none';
    }
}
function hideInfiniteScrollLoader() { showInfiniteScrollLoader(false); }

function showNoMoreResults() {
    if (noMoreResultsElement) {
        noMoreResultsElement.style.display = 'block';
    }
}
function hideNoMoreResults() {
    if (noMoreResultsElement) {
        noMoreResultsElement.style.display = 'none';
    }
}


export { 
    displayArticles, 
    appendArticles,
    showInitialLoadingIndicator, 
    clearResultsDisplay, 
    displayResultsCount, 
    displayGlobalError, 
    clearGlobalError,
    showInfiniteScrollLoader,
    hideInfiniteScrollLoader,
    showNoMoreResults,
    hideNoMoreResults
};
