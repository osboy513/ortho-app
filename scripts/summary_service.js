const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

/**
 * 논문 요약 서비스 클래스
 * OpenAI API를 사용하여 의학 논문 초록을 요약하는 기능을 제공합니다.
 */
class SummaryService {
    constructor() {
        // 이 클래스 안에 더 이상 API 키를 저장하지 않습니다.
        this.maxAbstractLength = 4000;
        this.summaryTemperature = 0.3;
    }

    /**
     * API 키 검증 함수
     * @param {string} apiKey - 검증할 API 키
     * @throws {Error} API 키가 유효하지 않은 경우
     */
    validateApiKey(apiKey) {
        if (!apiKey || !apiKey.trim()) {
            throw new Error("OpenAI API 키가 제공되지 않았습니다. 설정 탭에서 API 키를 입력해주세요.");
        }

        if (!apiKey.startsWith('sk-')) {
            throw new Error("유효하지 않은 OpenAI API 키 형식입니다. 키는 'sk-'로 시작해야 합니다.");
        }
    }

    /**
     * 텍스트 전처리 함수
     * @param {string} text - 전처리할 텍스트
     * @returns {string} 전처리된 텍스트
     */
    preprocessText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // HTML 태그 제거
        let processedText = text.replace(new RegExp('<[^>]*>?', 'gm'), ' ');
        
        // 연속된 공백을 하나로 변경
        processedText = processedText.replace(new RegExp('\\s\\s+', 'g'), ' ').trim();

        // 텍스트가 너무 긴 경우 자르기
        if (processedText.length > this.maxAbstractLength) {
            let cutPoint = processedText.lastIndexOf(' ', this.maxAbstractLength);
            if (cutPoint === -1 || cutPoint < this.maxAbstractLength / 2) {
                cutPoint = this.maxAbstractLength;
            }
            processedText = processedText.substring(0, cutPoint) + "... (내용이 길어 일부만 요약)";
        }

        return processedText;
    }

    /**
     * 단일 텍스트를 요약하는 함수
     * @param {string} text - 요약할 텍스트
     * @param {string} apiKey - OpenAI API 키
     * @returns {Promise<string>} 요약된 텍스트
     */
    async summarizeText(text, apiKey) {
        // API 키 검증
        this.validateApiKey(apiKey);

        // 텍스트 유효성 검사
        if (!text || text.trim() === '' || text === 'No abstract information.' || text === '초록 정보 없음.') {
            return '초록 내용이 없어 요약할 수 없습니다.';
        }

        // 텍스트 전처리
        const processedText = this.preprocessText(text);
        
        if (!processedText) {
            return '처리할 수 있는 텍스트 내용이 없습니다.';
        }

        try {
            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`, // 전달받은 apiKey 사용
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: OPENAI_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: '당신은 의학 논문 초록을 요약하는 전문가입니다. 한국어로 간결하고 정확하게 요약해주세요. 중요한 연구 결과와 임상적 의의를 포함해주세요.'
                        },
                        {
                            role: 'user',
                            content: `다음 의학 논문 초록을 한국어로 3-4문장으로 간결하게 요약해주세요. 주요 연구 목적, 방법, 결과, 결론을 포함해주세요:\n\n"${processedText}"`
                        }
                    ],
                    temperature: this.summaryTemperature,
                    max_tokens: 300
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // 구체적인 에러 메시지 제공
                if (response.status === 401) {
                    throw new Error("API 키가 유효하지 않습니다. 설정에서 올바른 OpenAI API 키를 입력해주세요.");
                } else if (response.status === 429) {
                    throw new Error("API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
                } else if (response.status === 403) {
                    throw new Error("API 키에 필요한 권한이 없습니다. OpenAI 계정을 확인해주세요.");
                } else if (response.status === 400) {
                    throw new Error("잘못된 요청입니다. 텍스트 내용을 확인해주세요.");
                } else {
                    throw new Error(errorData.error?.message || `OpenAI API 오류: ${response.status}`);
                }
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error("API 응답 형식이 올바르지 않습니다.");
            }

            return data.choices[0].message.content.trim();

        } catch (error) {
            console.error('OpenAI API Error:', error);
            
            // 네트워크 오류 등 기타 오류 처리
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
            }
            
            throw error;
        }
    }

    /**
     * 여러 논문을 일괄 처리하는 함수
     * @param {Array<Object>} papers - 처리할 논문 배열
     * @param {string} apiKey - OpenAI API 키
     * @returns {Promise<Array<Object>>} 요약이 추가된 논문 배열
     */
    async processPapers(papers, apiKey) {
        if (!papers || !Array.isArray(papers)) {
            throw new Error("유효한 논문 배열이 제공되지 않았습니다.");
        }

        // API 키 검증
        this.validateApiKey(apiKey);

        const paperPromises = papers.map(async (paper, index) => {
            try {
                // 요청 간격 조절 (API 제한 방지)
                if (index > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
                }

                const summary = await this.summarizeText(paper.abstract, apiKey);
                return {
                    ...paper,
                    summary: summary,
                    summaryStatus: 'success'
                };
            } catch (error) {
                console.error(`논문 ${paper.pmid || index} 요약 실패:`, error);
                return {
                    ...paper,
                    summary: `요약 생성 실패: ${error.message}`,
                    summaryStatus: 'error'
                };
            }
        });

        return Promise.all(paperPromises);
    }
}

// 기존 함수와의 호환성을 위한 래퍼 함수
const summaryService = new SummaryService();

/**
 * 기존 코드와의 호환성을 위한 함수
 * @param {string} abstractText - 요약할 초록 텍스트
 * @param {string} apiKey - OpenAI API 키
 * @returns {Promise<string>} 요약된 텍스트
 */
async function getOpenAISummary(abstractText, apiKey) {
    return await summaryService.summarizeText(abstractText, apiKey);
}

export { SummaryService, getOpenAISummary };
