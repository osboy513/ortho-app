import { loadAiSettings, resolveSelectedModel } from './summary_service.js';

const AI_SEARCH_API_URL = '/api/search-query';
const AI_SEARCH_RANK_API_URL = '/api/search-rank';

async function generateAiSearchQuery({ question, startDate, endDate, journals }) {
    const aiSettings = loadAiSettings();
    const selectedModel = resolveSelectedModel(aiSettings);

    const response = await fetch(AI_SEARCH_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            question,
            startDate,
            endDate,
            journals,
            aiProvider: aiSettings.provider,
            aiModel: selectedModel,
            aiApiKey: aiSettings.apiKey
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
            throw new Error('AI 검색 API가 실행 중이 아닙니다. 로컬에서는 npm run dev, 배포에서는 Vercel 환경을 사용해주세요.');
        }
        throw new Error(data.error || `AI 검색 서비스 오류: ${response.status}`);
    }

    if (!data.pubmedQuery) {
        throw new Error('AI가 PubMed 검색식을 만들지 못했습니다.');
    }

    return data;
}

async function rankAiSearchResults({ question, articles }) {
    const aiSettings = loadAiSettings();
    const selectedModel = resolveSelectedModel(aiSettings);

    const response = await fetch(AI_SEARCH_RANK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            question,
            articles,
            aiProvider: aiSettings.provider,
            aiModel: selectedModel,
            aiApiKey: aiSettings.apiKey
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
            throw new Error('AI 관련도 정렬 API가 실행 중이 아닙니다. 로컬에서는 npm run dev, 배포에서는 Vercel 환경을 사용해주세요.');
        }
        throw new Error(data.error || `AI 관련도 정렬 서비스 오류: ${response.status}`);
    }

    if (!Array.isArray(data.rankedArticles)) {
        throw new Error('AI가 관련도 정렬 결과를 만들지 못했습니다.');
    }

    const relevanceByPmid = new Map(
        data.rankedArticles.map(item => [
            String(item.pmid || ''),
            {
                score: Number(item.score) || 0,
                reason: item.reason || '',
                confidence: item.confidence || 'medium',
                model: data.model || ''
            }
        ])
    );

    return articles
        .map((article, index) => ({
            ...article,
            aiRelevance: relevanceByPmid.get(String(article.pmid || '')) || {
                score: 0,
                reason: 'AI 관련도 정렬 결과에 포함되지 않았습니다.',
                confidence: 'low',
                model: data.model || ''
            },
            originalRank: index
        }))
        .sort((a, b) => {
            const scoreDelta = (b.aiRelevance?.score || 0) - (a.aiRelevance?.score || 0);
            return scoreDelta || a.originalRank - b.originalRank;
        });
}

export { generateAiSearchQuery, rankAiSearchResults };
