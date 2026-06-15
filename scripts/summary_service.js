const SUMMARY_API_URL = '/api/summarize';

/**
 * 논문 요약 서비스 클래스
 * OpenAI API 키는 서버 환경변수로만 사용하고, 브라우저에는 저장하지 않습니다.
 */
class SummaryService {
    constructor() {
        this.statusCache = null;
    }

    async getStatus(forceRefresh = false) {
        if (this.statusCache && !forceRefresh) {
            return this.statusCache;
        }

        try {
            const response = await fetch(SUMMARY_API_URL, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`요약 서비스 상태 확인 실패: ${response.status}`);
            }

            this.statusCache = await response.json();
            return this.statusCache;
        } catch (error) {
            return {
                configured: false,
                unavailable: true,
                message: error.message || '요약 서비스에 연결할 수 없습니다.'
            };
        }
    }

    async summarizeArticle(article) {
        if (!article || typeof article !== 'object') {
            throw new Error('요약할 논문 정보가 올바르지 않습니다.');
        }

        if (!article.abstract || article.abstract === 'No abstract information.' || article.abstract === '초록 정보 없음.') {
            throw new Error('초록 내용이 없어 요약할 수 없습니다.');
        }

        const response = await fetch(SUMMARY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                pmid: article.pmid,
                title: article.title,
                journalName: article.journalName,
                publicationDate: article.publicationDate,
                abstract: article.abstract
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            if (response.status === 404 || response.status === 405) {
                throw new Error('AI 요약 API가 실행 중이 아닙니다. 로컬에서는 npm run dev, 배포에서는 Vercel 환경을 사용해주세요.');
            }
            throw new Error(data.error || `요약 서비스 오류: ${response.status}`);
        }

        return data;
    }
}

const summaryService = new SummaryService();

async function getSummaryServiceStatus(forceRefresh = false) {
    return summaryService.getStatus(forceRefresh);
}

async function getOpenAISummary(article) {
    return summaryService.summarizeArticle(article);
}

export { SummaryService, getSummaryServiceStatus, getOpenAISummary };
