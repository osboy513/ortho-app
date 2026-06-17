import { getOpenAISummary } from './summary_service.js';

const resultsCountElement = document.getElementById('results-count');
const errorMessageContainer = document.getElementById('error-message-container');
const initialLoadingIndicatorElement = document.getElementById('initial-loading-indicator');
const infiniteScrollLoaderElement = document.getElementById('infinite-scroll-loader');
const noMoreResultsElement = document.getElementById('no-more-results');
const emptyStateElement = document.getElementById('empty-state');

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

function icon(name) {
    const element = el('i');
    element.setAttribute('data-lucide', name);
    return element;
}

function createMetaPill(iconName, text) {
    const pill = el('span', 'meta-pill');
    pill.append(icon(iconName), document.createTextNode(text || 'N/A'));
    return pill;
}

function createAiRelevanceSection(article) {
    if (!article.aiRelevance) {
        return null;
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(article.aiRelevance.score) || 0)));
    const wrapper = el('section', 'ai-relevance-section');
    const header = el('div', 'ai-relevance-header');
    header.appendChild(el('h4', 'article-section-title', 'AI 관련도'));

    const scoreBadge = el('span', 'ai-relevance-score', `${score}`);
    scoreBadge.title = `AI 관련도 점수: ${score}/100`;
    header.appendChild(scoreBadge);
    wrapper.appendChild(header);

    if (article.aiRelevance.reason) {
        wrapper.appendChild(el('p', 'ai-relevance-reason', article.aiRelevance.reason));
    }

    return wrapper;
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
    const wrapper = el('section', 'abstract-section');
    wrapper.appendChild(el('h4', 'article-section-title', '초록'));

    const textContainer = el('div', 'abstract-text-container');
    if (!isAbstractAvailable(article)) {
        textContainer.appendChild(el('p', 'abstract-muted', '초록 정보 없음.'));
        wrapper.appendChild(textContainer);
        return wrapper;
    }

    const abstractContent = el('div', 'abstract-content');
    appendTextBlocks(abstractContent, article.abstract, '');
    textContainer.appendChild(abstractContent);

    const expandButton = el('button', 'expand-abstract-button', '자세히 보기');
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

    const meta = el('div', 'summary-chip-row');
    meta.appendChild(el('span', 'summary-chip', data.cached ? 'Cached' : 'New'));
    meta.appendChild(el('span', 'summary-chip', `Model: ${data.model || 'N/A'}`));
    container.appendChild(meta);

    if (summary.clinical_relevance) {
        container.appendChild(el('h5', '', '임상적 의미'));
        container.appendChild(el('p', '', summary.clinical_relevance));
    }

    if (Array.isArray(summary.key_points) && summary.key_points.length > 0) {
        container.appendChild(el('h5', '', '핵심 포인트'));
        const list = el('ul', '');
        summary.key_points.forEach(point => {
            list.appendChild(el('li', '', point));
        });
        container.appendChild(list);
    }

    if (summary.limitations) {
        container.appendChild(el('h5', '', '제한점'));
        container.appendChild(el('p', '', summary.limitations));
    }

    if (summary.confidence) {
        const confidence = el('p', 'abstract-muted', `신뢰도: ${summary.confidence}`);
        container.appendChild(confidence);
    }
}

function createSummarySection(article) {
    const wrapper = el('section', 'summary-section');
    const header = el('div', 'summary-section-header');
    header.appendChild(el('h4', 'article-section-title', 'AI 근거 요약'));

    const button = el('button', 'summary-button');
    button.type = 'button';
    button.dataset.pmid = article.pmid || '';
    button.disabled = !isAbstractAvailable(article);
    if (!isAbstractAvailable(article)) {
        button.title = '초록 정보가 없어 요약할 수 없습니다.';
    }

    const buttonText = el('span', 'button-text', '요약 보기');
    const spinner = el('span', 'button-spinner hidden');
    button.append(icon('sparkles'), buttonText, spinner);
    header.appendChild(button);
    wrapper.appendChild(header);

    const summaryContainer = el('div', 'summary-text-content');
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

function createArticleLink(href, iconName, text) {
    const link = el('a', 'article-action');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(icon(iconName), document.createTextNode(text));
    return link;
}

function buildCitation(article) {
    const parts = [
        article.authors,
        article.title,
        article.journalName,
        article.publicationDate
    ].filter(value => value && value !== 'N/A');

    const suffix = [
        article.doi ? `doi: ${article.doi}` : '',
        article.pmid && article.pmid !== 'N/A' ? `PMID: ${article.pmid}` : ''
    ].filter(Boolean).join('. ');

    return suffix ? `${parts.join('. ')}. ${suffix}` : parts.join('. ');
}

function createCopyCitationButton(article) {
    const button = el('button', 'article-action');
    button.type = 'button';
    button.append(icon('copy'), document.createTextNode('인용 복사'));

    button.addEventListener('click', async () => {
        const citation = buildCitation(article);
        try {
            await navigator.clipboard.writeText(citation);
            button.replaceChildren(icon('check'), document.createTextNode('복사됨'));
            setTimeout(() => {
                button.replaceChildren(icon('copy'), document.createTextNode('인용 복사'));
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }, 1400);
        } catch {
            button.replaceChildren(icon('copy'), document.createTextNode('복사 실패'));
        } finally {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    });

    return button;
}

function createArticleActions(article) {
    const actions = el('div', 'article-actions');

    if (article.pmid && article.pmid !== 'N/A') {
        actions.appendChild(createArticleLink(article.pmidLink || `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(article.pmid)}/`, 'external-link', 'PubMed'));
    }

    if (article.doi) {
        actions.appendChild(createArticleLink(`https://doi.org/${encodeURIComponent(article.doi)}`, 'link', 'DOI'));
    }

    actions.appendChild(createCopyCitationButton(article));

    const pmid = el('span', 'pmid-text', `PMID ${article.pmid || 'N/A'}`);
    actions.appendChild(pmid);

    return actions;
}

function createArticleCard(article) {
    const card = el('article', 'article-card');
    card.dataset.pmid = article.pmid || '';

    const header = el('div', 'article-card-header');
    header.appendChild(el('h3', 'article-title', article.title || 'No title information'));
    card.appendChild(header);

    const meta = el('div', 'article-meta');
    meta.appendChild(createMetaPill('book-open', article.journalName));
    meta.appendChild(createMetaPill('calendar-days', article.publicationDate || 'N/A'));
    if (article.aiRelevance) {
        meta.appendChild(createMetaPill('sparkles', `AI ${Math.round(Number(article.aiRelevance.score) || 0)}`));
    }
    if (article.doi) {
        meta.appendChild(createMetaPill('fingerprint', 'DOI'));
    }
    card.appendChild(meta);

    card.appendChild(el('p', 'article-authors', article.authors || 'No author information'));
    const relevanceSection = createAiRelevanceSection(article);
    if (relevanceSection) {
        card.appendChild(relevanceSection);
    }
    card.appendChild(createAbstractSection(article));
    card.appendChild(createSummarySection(article));
    card.appendChild(createArticleActions(article));

    return card;
}

function displayArticles(articles, articlesListElement, isNewSearch) {
    if (isNewSearch) {
        articlesListElement.replaceChildren();
    }
    if (articles.length > 0) {
        hideEmptyState();
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

    const alert = el('div', 'error-alert');
    alert.setAttribute('role', 'alert');

    const textWrap = el('div');
    textWrap.appendChild(el('strong', '', '오류'));
    textWrap.appendChild(el('p', 'text-sm', message));

    alert.append(icon('alert-triangle'), textWrap);
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
        infiniteScrollLoaderElement.style.display = show ? 'flex' : 'none';
    }
}
function hideInfiniteScrollLoader() { showInfiniteScrollLoader(false); }

function showNoMoreResults() {
    if (noMoreResultsElement) {
        noMoreResultsElement.style.display = 'flex';
    }
}
function hideNoMoreResults() {
    if (noMoreResultsElement) {
        noMoreResultsElement.style.display = 'none';
    }
}

function showEmptyState(title = '검색 대기', description = '기간과 저널을 선택하면 PubMed 결과가 여기에 표시됩니다.') {
    if (!emptyStateElement) {
        return;
    }

    const titleElement = emptyStateElement.querySelector('h3');
    const descriptionElement = emptyStateElement.querySelector('p');

    if (titleElement) {
        titleElement.textContent = title;
    }
    if (descriptionElement) {
        descriptionElement.textContent = description;
    }

    emptyStateElement.style.display = 'flex';

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function hideEmptyState() {
    if (emptyStateElement) {
        emptyStateElement.style.display = 'none';
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
    hideNoMoreResults,
    showEmptyState,
    hideEmptyState
};
