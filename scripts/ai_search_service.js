import { loadAiSettings, resolveSelectedModel } from './summary_service.js';

const AI_SEARCH_API_URL = '/api/search-query';

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

export { generateAiSearchQuery };
