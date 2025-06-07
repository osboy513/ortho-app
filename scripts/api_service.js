const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const NCBI_API_KEY = 'cf411c1cb35812683dc54567728468d10b07'; // NCBI API 키는 공개 사용 가능하므로 유지

/**
 * PubMed API에 직접 요청하는 함수
 * @param {Object} queryOptions - 검색 옵션 객체
 * @param {string} queryOptions.startDate - 검색 시작 날짜
 * @param {string} queryOptions.endDate - 검색 종료 날짜
 * @param {Array} queryOptions.journals - 저널 목록
 * @param {string} queryOptions.keywords - 검색 키워드
 * @param {number} queryOptions.retstart - 검색 시작 위치 (기본값: 0)
 * @param {number} queryOptions.retmax - 최대 결과 수 (기본값: 15)
 * @returns {Promise<{articles: Array, totalResults: number}>} 검색 결과
 */
async function searchPubMed(queryOptions) {
    const { startDate, endDate, journals, keywords, retstart = 0, retmax = 15 } = queryOptions;

    // 검색 매개변수 설정
    let searchTerms = [];
    
    // 저널 필터 처리
    if (journals && journals.length > 0) {
        const journalQuery = journals.map(journal => `"${journal}"[Journal]`).join(' OR ');
        searchTerms.push(`(${journalQuery})`);
    }
    
    // 날짜 필터 처리 (수정된 부분)
    if (startDate && endDate) {
        try {
            // startDate 처리: YYYY-MM 형식을 YYYY/MM/01로 변환
            let startDateFormatted = '';
            if (startDate.match(/^\d{4}-\d{2}$/)) {
                startDateFormatted = startDate.replace('-', '/') + '/01';
            } else if (startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                startDateFormatted = startDate.replace(/-/g, '/');
            } else {
                console.warn('Invalid startDate format:', startDate);
                startDateFormatted = startDate.replace('-', '/') + '/01';
            }

            // endDate 처리: YYYY-MM 형식을 해당 월의 마지막 날로 변환
            let endDateFormatted = '';
            if (endDate.match(/^\d{4}-\d{2}$/)) {
                const [year, month] = endDate.split('-').map(Number);
                // 해당 월의 마지막 날짜 계산
                const lastDayOfMonth = new Date(year, month, 0).getDate();
                endDateFormatted = `${year.toString().padStart(4, '0')}/${month.toString().padStart(2, '0')}/${lastDayOfMonth.toString().padStart(2, '0')}`;
            } else if (endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                endDateFormatted = endDate.replace(/-/g, '/');
            } else {
                console.warn('Invalid endDate format:', endDate);
                const [year, month] = endDate.split('-').map(Number);
                const lastDayOfMonth = new Date(year, month, 0).getDate();
                endDateFormatted = `${year.toString().padStart(4, '0')}/${month.toString().padStart(2, '0')}/${lastDayOfMonth.toString().padStart(2, '0')}`;
            }

            console.log('PubMed 날짜 쿼리:', startDateFormatted, endDateFormatted);
            searchTerms.push(`("${startDateFormatted}"[Date - Publication] : "${endDateFormatted}"[Date - Publication])`);
        } catch (error) {
            console.error('Date processing error:', error);
            // 날짜 처리 실패 시 원본 값 사용 (fallback)
            searchTerms.push(`("${startDate}"[Date - Publication] : "${endDate}"[Date - Publication])`);
        }
    }
    
    // 키워드 처리
    if (keywords && keywords.trim()) {
        searchTerms.push(`(${keywords})`);
    }
    
    // 검색어가 없으면 기본 검색
    if (searchTerms.length === 0) {
        searchTerms.push("orthopedics[MeSH Terms]");
    }
    
    const searchTerm = searchTerms.join(" AND ");
    console.log('최종 PubMed 쿼리:', searchTerm);
    
    try {
        // ESearch로 ID 목록 가져오기
        const searchUrl = `${ESEARCH_URL}?db=pubmed&term=${encodeURIComponent(searchTerm)}&retstart=${retstart}&retmax=${retmax}&sort=pub+date&api_key=${NCBI_API_KEY}&retmode=json`;
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            throw new Error(`NCBI ESearch API error: ${searchResponse.status} ${searchResponse.statusText}`);
        }
        
        const searchData = await searchResponse.json();
        const ids = searchData.esearchresult.idlist;
        const totalResults = parseInt(searchData.esearchresult.count);
        
        if (ids.length === 0) {
            return { articles: [], totalResults };
        }
        
        // EFetch로 논문 상세 정보 가져오기
        const fetchUrl = `${EFETCH_URL}?db=pubmed&id=${ids.join(",")}&retmode=xml&api_key=${NCBI_API_KEY}`;
        
        const fetchResponse = await fetch(fetchUrl);
        if (!fetchResponse.ok) {
            throw new Error(`NCBI EFetch API error: ${fetchResponse.status} ${fetchResponse.statusText}`);
        }
        
        const xmlText = await fetchResponse.text();
        const articles = parseArticleXml(xmlText);
        
        return {
            articles,
            totalResults
        };
    } catch (error) {
        console.error("PubMed API Error:", error);
        throw error;
    }
}

/**
 * OpenAI API를 통해 요약 생성 - API 키를 파라미터로 받음
 * @param {string} abstractText - 요약할 초록 텍스트
 * @param {string} openaiApiKey - OpenAI API 키
 * @returns {Promise<string>} 요약된 텍스트 또는 오류 메시지
 */
async function getOpenAISummary(abstractText, openaiApiKey) {
    // API 키 검증
    if (!openaiApiKey || !openaiApiKey.trim()) {
        throw new Error("OpenAI API 키가 제공되지 않았습니다. 설정 탭에서 API 키를 입력해주세요.");
    }

    // API 키 형식 간단 검증
    if (!openaiApiKey.startsWith('sk-')) {
        throw new Error("유효하지 않은 OpenAI API 키 형식입니다. 키는 'sk-'로 시작해야 합니다.");
    }

    if (!abstractText || abstractText.trim() === '' || abstractText === 'No abstract information.' || abstractText === '초록 정보 없음.') {
        return '초록 내용이 없어 요약할 수 없습니다.';
    }

    const MAX_ABSTRACT_LENGTH = 4000; 
    let processedAbstract = abstractText.replace(new RegExp('<[^>]*>?', 'gm'), ' '); 
    processedAbstract = processedAbstract.replace(new RegExp('\\s\\s+', 'g'), ' ').trim(); 

    if (processedAbstract.length > MAX_ABSTRACT_LENGTH) {
        let cutPoint = processedAbstract.lastIndexOf(' ', MAX_ABSTRACT_LENGTH);
        if (cutPoint === -1 || cutPoint < MAX_ABSTRACT_LENGTH / 2) cutPoint = MAX_ABSTRACT_LENGTH;
        processedAbstract = processedAbstract.substring(0, cutPoint) + "... (내용이 길어 일부만 요약)";
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}` // 전달받은 API 키 사용
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 의학 논문 초록을 요약하는 전문가입니다. 한국어로 간결하게 요약해주세요. 의학용어, 해부학용어, 의료기기명, 약품명 등은 영어 그대로 유지하고 한글로 번역하지 마세요.'
                    },
                    {
                        role: 'user',
                        content: `다음 의학 논문 초록을 한국어로 3-4문장으로 간결하게 요약해주세요. 의학용어, 해부학용어, 의료기기명, 약품명은 영어 그대로 유지해주세요: "${processedAbstract}"`
                    }
                ],
                temperature: 0.1
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
            } else {
                throw new Error(errorData.error?.message || `OpenAI API 오류: ${response.status}`);
            }
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI API Error:', error);
        
        // 네트워크 오류 등 기타 오류 처리
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
        }
        
        throw error; // 이미 처리된 오류는 그대로 전달
    }
}

/**
 * 발행일 파싱 함수
 * @param {Element} articleNode - XML 기사 노드
 * @returns {string} 파싱된 날짜 문자열
 */
function parsePublicationDate(articleNode) {
    let year = 'N/A', month = 'N/A', day = 'N/A';

    const pubDateNode = articleNode.querySelector('PubmedData > History > PubMedPubDate[pubstatus="pubmed"], PubDate, ArticleDate');
    
    if (pubDateNode) {
        const yearNode = pubDateNode.querySelector('Year');
        if (yearNode) year = yearNode.textContent;
        
        const monthNode = pubDateNode.querySelector('Month');
        if (monthNode) month = monthNode.textContent;
        
        const dayNode = pubDateNode.querySelector('Day');
        if (dayNode) day = dayNode.textContent;

        if (isNaN(parseInt(month))) {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase());
            if (monthIndex !== -1) {
                month = (monthIndex + 1).toString().padStart(2, '0');
            }
        } else {
            month = month.padStart(2, '0');
        }
        day = day.padStart(2, '0');

        if (year !== 'N/A' && month !== 'N/A' && day !== 'N/A') {
            return `${year}-${month}-${day}`;
        } else if (year !== 'N/A' && month !== 'N/A') {
            return `${year}-${month}`;
        } else if (year !== 'N/A') {
            return year;
        }
    }
    return 'No date information';
}

/**
 * 논문 XML 파싱 함수
 * @param {string} xmlText - PubMed EFetch API의 XML 응답 문자열
 * @returns {Array<Object>} 파싱된 논문 객체 배열
 */
function parseArticleXml(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const articles = [];

    xmlDoc.querySelectorAll('PubmedArticle').forEach(articleNode => {
        const pmidNode = articleNode.querySelector('MedlineCitation > PMID');
        const pmid = pmidNode ? pmidNode.textContent : 'N/A';

        const titleNode = articleNode.querySelector('ArticleTitle');
        const title = titleNode ? titleNode.textContent : 'No title information';

        const authorNodes = articleNode.querySelectorAll('AuthorList Author');
        let authors = Array.from(authorNodes).map(authorNode => {
            const lastName = authorNode.querySelector('LastName')?.textContent || '';
            const initials = authorNode.querySelector('Initials')?.textContent || '';
            return `${lastName} ${initials}`.trim();
        }).filter(name => name).join(', ');
        if (!authors) authors = "No author information";

        const journalTitleNode = articleNode.querySelector('Journal Title');
        const journalISOAbbreviationNode = articleNode.querySelector('Journal ISOAbbreviation');
        let journalName = journalTitleNode ? journalTitleNode.textContent : (journalISOAbbreviationNode ? journalISOAbbreviationNode.textContent : 'No journal information');

        const abstractNodes = articleNode.querySelectorAll('Abstract AbstractText');
        let abstract = Array.from(abstractNodes).map(node => {
            const label = node.getAttribute('Label');
            const text = node.textContent;

            return label ? `<strong>${label.trim()}:</strong> ${text}` : text;
        }).join('<br><br>');
        if (!abstract) abstract = 'No abstract information.';
        
        const publicationDate = parsePublicationDate(articleNode);

        articles.push({ pmid, title, authors, journalName, abstract, publicationDate });
    });

    return articles;
}

/**
 * 메인 검색 함수 - 외부에서 호출되는 함수
 * @param {Object} queryOptions - 검색 옵션
 * @returns {Promise<{articles: Array, totalResults: number}>} 검색 결과
 */
async function searchNCBI(queryOptions) {
    try {
        return await searchPubMed(queryOptions);
    } catch (error) {
        console.error('Search API Error:', error);
        throw error;
    }
}

export { searchNCBI, getOpenAISummary };
