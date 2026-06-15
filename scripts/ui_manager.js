import { getOpenAISummary } from './summary_service.js';

const resultsCountElement = document.getElementById('results-count');
const errorMessageContainer = document.getElementById('error-message-container');
const initialLoadingIndicatorElement = document.getElementById('initial-loading-indicator');
const infiniteScrollLoaderElement = document.getElementById('infinite-scroll-loader');
const noMoreResultsElement = document.getElementById('no-more-results');

function el(tagName, className = '', text = '') {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text) {
        element.textContent = text;
    }
    return element;
}

function appendField(container, label, value) {
    const paragraph = el('p', 'text-xs text-gray-600 mb-0.5');
    const strong = el('strong', '', `${label}: `);
    paragraph.append(strong, document.createTextNode(value || 'N/A'));
    container.appendChild(paragraph);
}

function appendTextBlocks(container, text, className) {
    const blocks = String(text || '').split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
    blocks.forEach(block => {
        container.appendChild(el('p', className, block));
    });
}

function isAbstractAvailable(article) {
    return Boolean(
        article.abstract &&
        article.abstract !== 'No abstract information.' &&
        article.abstract !== '초록 정보 없음.'
    );
}

function createAbstractSection(article) {
    const wrapper = el('div', 'mb-2.5');
    wrapper.appendChild(el('h4', 'text-xs font-semibold text-[#1F2937] mb-0.5', '초록:'));

    const textContainer = el('div', 'abstract-text-container');
    if (!isAbstractAvailable(article)) {
        textContainer.appendChild(el('p', 'text-sm text-gray-500 italic', '초록 정보 없음.'));
        wrapper.appendChild(textContainer);
        return wrapper;
    }

    const abstractContent = el('div', 'abstract-content text-sm text-[#1F2937]');
    appendTextBlocks(abstractContent, article.abstract, 'mb-2 last:mb-0');
    textContainer.appendChild(abstractContent);

    const expandButton = el('button', 'text-xs text-[#1F2937] hover:underline mt-1.5 expand-abstract-button', '자세히 보기');
    expandButton.type = 'button';
    expandButton.addEventListener('click', () => {
        abstractContent.classList.toggle('expanded');
        expandButton.textContent = abstractContent.classList.contains('expanded') ? '간략히 보기' : '자세히 보기';
    });
    textContainer.appendChild(expandButton);
    wrapper.appendChild(textContainer);

    return wrapper;
}

function setSummaryLoading(button, textElement, spinnerElement, isLoading) {
    button.disabled = isLoading;
    textElement.classList.toggle('hidden', isLoading);
    spinnerElement.classList.toggle('hidden', !isLoading);
}

function renderSummaryError(container, message) {
    container.replaceChildren();
    container.hidden = false;
    container.dataset.error = 'true';
    container.dataset.loaded = 'false';
    container.appendChild(el('p', 'summary-error', message));
}

function renderSummary(container, data) {
    const summary = data.summary || {};
    container.replaceChildren();
    container.hidden = false;
    container.dataset.error = 'false';
    container.dataset.loaded = 'true';

    const meta = el('div', 'mb-3 flex flex-wrap items-center gap-2');
    meta.appendChild(el('span', 'inline-flex rounded-full bg-[#E7F3EF] px-2 py-0.5 text-[11px] font-semibold text-[#0F766E]', data.cached ? 'Cached' : 'New'));
    meta.appendChild(el('span', 'text-[11px] text-gray-500', `Model: ${data.model || 'N/A'}`));
    container.appendChild(meta);

    if (summary.clinical_relevance) {
        container.appendChild(el('h5', 'text-xs font-semibold text-[#1F2937] mb-1', 'Clinical relevance'));
        container.appendChild(el('p', 'mb-3 text-sm text-[#1F2937]', summary.clinical_relevance));
    }

    if (Array.isArray(summary.key_points) && summary.key_points.length > 0) {
        container.appendChild(el('h5', 'text-xs font-semibold text-[#1F2937] mb-1', 'Key points'));
        const list = el('ul', 'mb-3 list-disc pl-5 text-sm text-[#1F2937] space-y-1');
        summary.key_points.forEach(point => {
            list.appendChild(el('li', '', point));
        });
        container.appendChild(list);
    }

    if (summary.limitations) {
        container.appendChild(el('h5', 'text-xs font-semibold text-[#1F2937] mb-1', 'Limitations'));
        container.appendChild(el('p', 'mb-3 text-sm text-[#1F2937]', summary.limitations));
    }

    if (summary.confidence) {
        const confidence = el('p', 'text-[11px] text-gray-500', `Confidence: ${summary.confidence}`);
        container.appendChild(confidence);
    }
}

function createSummarySection(article) {
    const wrapper = el('div');
    wrapper.appendChild(el('h4', 'text-xs font-semibold text-[#1F2937] mb-1', 'AI 근거 요약:'));

    const button = el('button', 'summary-button text-xs bg-[#1F2937] text-white hover:bg-[#0F766E] py-1 px-2.5 rounded-md transition duration-150 ease-in-out');
    button.type = 'button';
    button.dataset.pmid = article.pmid || '';
    button.disabled = !isAbstractAvailable(article);
    if (!isAbstractAvailable(article)) {
        button.title = '초록 정보가 없어 요약할 수 없습니다.';
    }

    const buttonText = el('span', 'button-text', '요약 보기');
    const spinner = el('span', 'button-spinner hidden w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1.5');
    button.append(buttonText, spinner);
    wrapper.appendChild(button);

    const summaryContainer = el('div', 'summary-text-content mt-1.5 p-3 rounded-md bg-[#EEF5F2] text-xs text-[#1F2937]');
    summaryContainer.hidden = true;
    wrapper.appendChild(summaryContainer);

    button.addEventListener('click', async () => {
        if (summaryContainer.dataset.loaded === 'true' && summaryContainer.dataset.error !== 'true') {
            summaryContainer.hidden = !summaryContainer.hidden;
            return;
        }

        setSummaryLoading(button, buttonText, spinner, true);
        summaryContainer.replaceChildren(el('em', 'text-gray-500', 'AI 요약 생성 중...'));
        summaryContainer.hidden = false;
        summaryContainer.dataset.error = 'false';

        try {
            const summaryData = await getOpenAISummary(article);
            renderSummary(summaryContainer, summaryData);
        } catch (error) {
            console.error(`Error fetching OpenAI summary for PMID ${article.pmid}:`, error);
            renderSummaryError(summaryContainer, `AI 요약 실패: ${error.message || '알 수 없는 오류'}`);
        } finally {
            setSummaryLoading(button, buttonText, spinner, false);
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    });

    return wrapper;
}

function createPmidLink(article) {
    const paragraph = el('p', 'mt-2.5 text-xs text-gray-500');
    paragraph.appendChild(document.createTextNode('PMID: '));

    if (article.pmid && article.pmid !== 'N/A') {
        const link = el('a', 'text-[#1F2937] hover:underline', article.pmid);
        link.href = article.pmidLink || `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(article.pmid)}/`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        paragraph.appendChild(link);
    } else {
        paragraph.appendChild(document.createTextNode('N/A'));
    }

    return paragraph;
}

function createArticleCard(article) {
    const card = el('div', 'article-card p-4 sm:p-5 rounded-lg shadow-md border border-[#CFE3DC]');
    card.dataset.pmid = article.pmid || '';

    card.appendChild(el('h3', 'text-md sm:text-lg font-semibold article-title mb-1.5', article.title || 'No title information'));
    appendField(card, '저자', article.authors);
    appendField(card, '저널', article.journalName);
    appendField(card, '출간일', article.publicationDate || 'N/A');
    card.appendChild(createAbstractSection(article));
    card.appendChild(createSummarySection(article));
    card.appendChild(createPmidLink(article));

    return card;
}

function displayArticles(articles, articlesListElement, isNewSearch) {
    if (isNewSearch) {
        articlesListElement.replaceChildren();
    }
    articles.forEach(article => {
        const articleCard = createArticleCard(article);
        articlesListElement.appendChild(articleCard);
    });
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
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
    if (articlesListElement) articlesListElement.replaceChildren();
    if (resultsCountElement) resultsCountElement.textContent = '';
    clearGlobalError();
}

function displayResultsCount(message) {
    if (resultsCountElement) {
        resultsCountElement.textContent = message;
    }
}

function displayGlobalError(message) {
    if (!errorMessageContainer) {
        return;
    }

    const alert = el('div', 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative');
    alert.setAttribute('role', 'alert');

    const row = el('div', 'flex');
    const iconWrap = el('div', 'py-1');
    const icon = el('i', 'h-5 w-5 text-red-500 mr-3');
    icon.setAttribute('data-lucide', 'alert-triangle');
    iconWrap.appendChild(icon);

    const textWrap = el('div');
    textWrap.appendChild(el('p', 'font-bold', '오류'));
    textWrap.appendChild(el('p', 'text-sm', message));

    row.append(iconWrap, textWrap);
    alert.appendChild(row);
    errorMessageContainer.replaceChildren(alert);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function clearGlobalError() {
    if (errorMessageContainer) {
        errorMessageContainer.replaceChildren();
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
