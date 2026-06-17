import { journalCategories } from './journal_data.js';

const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const REQUEST_DELAY_MS = Number(process.env.PUBMED_VALIDATE_DELAY_MS || 350);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getPubMedTerms(journal) {
    const terms = Array.isArray(journal.pubmedTerms) && journal.pubmedTerms.length > 0
        ? journal.pubmedTerms
        : [journal.abbr || journal.name];

    return Array.from(new Set(
        terms.map(term => String(term || '').trim()).filter(Boolean)
    ));
}

function buildJournalQuery(journal) {
    return getPubMedTerms(journal)
        .map(term => `"${term.replace(/"/g, '\\"')}"[Journal]`)
        .join(' OR ');
}

async function fetchPubMedCount(term) {
    const url = new URL(ESEARCH_URL);
    url.search = new URLSearchParams({
        db: 'pubmed',
        term,
        retmode: 'json',
        retmax: '0'
    }).toString();

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`PubMed ESearch failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return Number(data.esearchresult?.count || 0);
}

function collectJournals(categories) {
    return categories.flatMap(category => {
        const directJournals = (category.journals || []).map(journal => ({
            category: category.name,
            ...journal
        }));

        const nestedJournals = (category.subCategories || []).flatMap(subCategory =>
            (subCategory.journals || []).map(journal => ({
                category: `${category.name} > ${subCategory.name}`,
                ...journal
            }))
        );

        return [...directJournals, ...nestedJournals];
    });
}

const journals = collectJournals(journalCategories);

const zeroCountJournals = [];
let checkedCount = 0;

for (const journal of journals) {
    const term = buildJournalQuery(journal);
    const count = await fetchPubMedCount(term);
    checkedCount += 1;

    if (count === 0) {
        zeroCountJournals.push({
            category: journal.category,
            name: journal.name,
            abbr: journal.abbr || '',
            pubmedTerms: getPubMedTerms(journal)
        });
    }

    await sleep(REQUEST_DELAY_MS);
}

if (zeroCountJournals.length > 0) {
    console.error('PubMed journal aliases need review:');
    console.error(JSON.stringify(zeroCountJournals, null, 2));
    process.exitCode = 1;
} else {
    console.log(`All ${checkedCount} journals returned at least one PubMed result.`);
}
