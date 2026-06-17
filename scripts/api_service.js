const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const NCBI_API_KEY = '';

function buildNcbiQuery(params) {
    const searchParams = new URLSearchParams(params);
    if (NCBI_API_KEY) {
        searchParams.set('api_key', NCBI_API_KEY);
    }
    return searchParams.toString();
}

function escapePubMedPhrase(value) {
    return String(value || '').replace(/"/g, '\\"').trim();
}

function buildJournalQuery(journals = []) {
    const terms = journals
        .map(journal => Array.isArray(journal) ? journal : [journal])
        .map(group => group.map(escapePubMedPhrase).filter(Boolean))
        .filter(group => group.length > 0)
        .map(group => {
            const query = group.map(term => `"${term}"[Journal]`).join(' OR ');
            return group.length > 1 ? `(${query})` : query;
        });

    return terms.join(' OR ');
}

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
        const journalQuery = buildJournalQuery(journals);
        if (journalQuery) {
            searchTerms.push(`(${journalQuery})`);
        }
    }
    
    // 날짜 필터 처리 - 포괄적인 날짜 검색
    if (startDate && endDate) {
        try {
            // YYYY-MM 형식을 YYYY/MM/01 및 YYYY/MM/마지막날로 변환
            const [startYear, startMonth] = startDate.split('-').map(Number);
            const [endYear, endMonth] = endDate.split('-').map(Number);
            
            // 시작일: 해당 월의 첫날
            const startDateFormatted = `${startYear}/${String(startMonth).padStart(2, '0')}/01`;
            
            // 종료일: 해당 월의 마지막 날
            const lastDayOfMonth = new Date(endYear, endMonth, 0).getDate();
            const endDateFormatted = `${endYear}/${String(endMonth).padStart(2, '0')}/${String(lastDayOfMonth).padStart(2, '0')}`;
            
            console.log('PubMed 날짜 쿼리 범위:', startDateFormatted, '-', endDateFormatted);
            
            // 여러 날짜 필드를 OR로 연결하여 포괄적 검색
            const dateQuery = [
                `"${startDateFormatted}"[Date - Entrez] : "${endDateFormatted}"[Date - Entrez]`,
                `"${startDateFormatted}"[Date - Publication] : "${endDateFormatted}"[Date - Publication]`,
                `"${startDateFormatted}"[Date - Create] : "${endDateFormatted}"[Date - Create]`
            ].join(' OR ');
            
            searchTerms.push(`(${dateQuery})`);
        } catch (error) {
            console.error('Date processing error:', error);
            // 날짜 처리 실패 시 쿼리에서 제외
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
        const searchUrl = `${ESEARCH_URL}?${buildNcbiQuery({
            db: 'pubmed',
            term: searchTerm,
            retstart,
            retmax,
            sort: 'pub date',
            retmode: 'json'
        })}`;
        
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
        const fetchUrl = `${EFETCH_URL}?${buildNcbiQuery({
            db: 'pubmed',
            id: ids.join(','),
            retmode: 'xml'
        })}`;
        
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
 * 발행일 파싱 함수
 * @param {Element} articleNode - XML 기사 노드
 * @returns {string} 파싱된 날짜 문자열
 */
function parsePublicationDate(articleNode) {
    let year = '', month = '', day = '';

    // 여러 날짜 소스를 우선순위에 따라 체크 (EntrezDate 최우선)
    const dateNodes = [
        articleNode.querySelector('PubmedData > History > PubMedPubDate[PubStatus="entrez"]'),
        articleNode.querySelector('PubmedData > History > PubMedPubDate[PubStatus="pubmed"]'),
        articleNode.querySelector('Article > ArticleDate[DateType="Electronic"]'),
        articleNode.querySelector('Article > Journal > JournalIssue > PubDate'),
        articleNode.querySelector('MedlineCitation > DateCompleted'),
        articleNode.querySelector('MedlineCitation > DateRevised')
    ];

    for (const dateNode of dateNodes) {
        if (dateNode) {
            // Year
            const yearNode = dateNode.querySelector('Year');
            if (yearNode) year = yearNode.textContent;

            // Month
            const monthNode = dateNode.querySelector('Month');
            if (monthNode) {
                const monthText = monthNode.textContent;
                const monthMap = {
                    'Jan': '01', 'January': '01',
                    'Feb': '02', 'February': '02',
                    'Mar': '03', 'March': '03',
                    'Apr': '04', 'April': '04',
                    'May': '05',
                    'Jun': '06', 'June': '06',
                    'Jul': '07', 'July': '07',
                    'Aug': '08', 'August': '08',
                    'Sep': '09', 'September': '09',
                    'Oct': '10', 'October': '10',
                    'Nov': '11', 'November': '11',
                    'Dec': '12', 'December': '12'
                };
                month = monthMap[monthText] || (isNaN(monthText) ? '' : monthText.padStart(2, '0'));
            }

            // Day
            const dayNode = dateNode.querySelector('Day');
            if (dayNode) day = dayNode.textContent.padStart(2, '0');

            // MedlineDate 파싱
            const medlineDateNode = dateNode.querySelector('MedlineDate');
            if (medlineDateNode && !year) {
                const medlineText = medlineDateNode.textContent;
                const yearMatch = medlineText.match(/(\d{4})/);
                if (yearMatch) year = yearMatch[1];
                
                const monthMatch = medlineText.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
                if (monthMatch) {
                    const monthMap = {
                        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                    };
                    month = monthMap[monthMatch[1]] || month;
                }
            }

            if (year) break; // 날짜를 찾았으면 중단
        }
    }

    // 날짜 포맷팅
    if (year && month && day) {
        return `${year}-${month}-${day}`;
    } else if (year && month) {
        return `${year}-${month}`;
    } else if (year) {
        return `${year}`;
    }
    
    return '';
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
            return label ? `${label.trim()}: ${text}` : text;
        }).join('\n\n');
        if (!abstract) abstract = 'No abstract information.';
        
        const publicationDate = parsePublicationDate(articleNode);

        // DOI 추출
        let doi = '';
        const articleIdNodes = articleNode.querySelectorAll('ArticleIdList > ArticleId');
        articleIdNodes.forEach(idNode => {
            if (idNode.getAttribute('IdType') === 'doi') {
                doi = idNode.textContent;
            }
        });
        // PubMed 링크
        const pmidLink = pmid !== 'N/A' ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : '';

        articles.push({ pmid, title, authors, journalName, abstract, publicationDate, doi, pmidLink });
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

// PubMed history 기능을 활용해 전체 논문을 export용으로 가져오는 함수
async function fetchAllArticlesForExport(queryOptions) {
    // PubMed 쿼리 생성 (searchPubMed와 동일하게)
    let searchTerms = [];
    if (queryOptions.journals && queryOptions.journals.length > 0) {
        const journalQuery = buildJournalQuery(queryOptions.journals);
        if (journalQuery) {
            searchTerms.push(`(${journalQuery})`);
        }
    }
    // 날짜 필터
    if (queryOptions.startDate && queryOptions.endDate) {
        try {
            const [startYear, startMonth] = queryOptions.startDate.split('-').map(Number);
            const [endYear, endMonth] = queryOptions.endDate.split('-').map(Number);
            const startDateFormatted = `${startYear}/${String(startMonth).padStart(2, '0')}/01`;
            const lastDayOfMonth = new Date(endYear, endMonth, 0).getDate();
            const endDateFormatted = `${endYear}/${String(endMonth).padStart(2, '0')}/${String(lastDayOfMonth).padStart(2, '0')}`;
            const dateQuery = [
                `"${startDateFormatted}"[Date - Entrez] : "${endDateFormatted}"[Date - Entrez]`,
                `"${startDateFormatted}"[Date - Publication] : "${endDateFormatted}"[Date - Publication]`,
                `"${startDateFormatted}"[Date - Create] : "${endDateFormatted}"[Date - Create]`
            ].join(' OR ');
            searchTerms.push(`(${dateQuery})`);
        } catch (error) {
            // 날짜 처리 실패 시 무시
        }
    }
    if (queryOptions.term && queryOptions.term.trim()) {
        searchTerms.push(`(${queryOptions.term})`);
    }
    if (searchTerms.length === 0) {
        searchTerms.push("orthopedics[MeSH Terms]");
    }
    const searchTerm = searchTerms.join(" AND ");

    // 1. ESearch로 전체 pmid 목록 및 WebEnv/QueryKey 확보
    const params = new URLSearchParams({
        db: 'pubmed',
        term: searchTerm,
        usehistory: 'y',
        retmax: 0
    });
    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params.toString()}`;
    const esearchRes = await fetch(esearchUrl);
    const esearchText = await esearchRes.text();
    const esearchXml = new window.DOMParser().parseFromString(esearchText, 'text/xml');
    const count = parseInt(esearchXml.querySelector('Count')?.textContent || '0', 10);
    const webEnv = esearchXml.querySelector('WebEnv')?.textContent;
    const queryKey = esearchXml.querySelector('QueryKey')?.textContent;
    if (!webEnv || !queryKey || count === 0) return [];

    // 2. EFetch로 200개씩 반복 요청
    const articles = [];
    const batchSize = 200;
    for (let retstart = 0; retstart < count; retstart += batchSize) {
        const efetchParams = new URLSearchParams({
            db: 'pubmed',
            query_key: queryKey,
            WebEnv: webEnv,
            retstart: retstart,
            retmax: batchSize,
            rettype: 'xml'
        });
        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${efetchParams.toString()}`;
        const efetchRes = await fetch(efetchUrl);
        const efetchText = await efetchRes.text();
        const batchArticles = parseArticleXml(efetchText);
        articles.push(...batchArticles);
    }

    // post-filter: publicationDate가 기간 내에 있는 논문만 반환
    if (queryOptions.startDate && queryOptions.endDate) {
        const start = queryOptions.startDate;
        const end = queryOptions.endDate;
        // YYYY-MM 또는 YYYY-MM-DD 형식 지원
        return articles.filter(a => {
            if (!a.publicationDate) return false;
            // YYYY-MM-DD, YYYY-MM, YYYY 모두 지원
            const pub = a.publicationDate.length === 4 ? a.publicationDate + '-01-01'
                : a.publicationDate.length === 7 ? a.publicationDate + '-01'
                : a.publicationDate;
            return pub >= start + '-01' && pub <= end + '-31';
        });
    }
    return articles;
}

export { searchNCBI, fetchAllArticlesForExport };
