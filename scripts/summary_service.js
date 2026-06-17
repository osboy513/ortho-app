const SUMMARY_API_URL = '/api/summarize';
const AI_SETTINGS_STORAGE_KEY = 'ortho.aiSettings.v1';

const AI_PROVIDER_PRESETS = {
    openai: {
        label: 'OpenAI',
        apiKeyPlaceholder: 'sk-...',
        models: [
            { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
            { value: 'gpt-5.4', label: 'GPT-5.4' },
            { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
            { value: 'gpt-4.1', label: 'GPT-4.1' }
        ]
    },
    gemini: {
        label: 'Google Gemini',
        apiKeyPlaceholder: 'AIza...',
        models: [
            { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }
        ]
    }
};

function getDefaultAiSettings() {
    return {
        provider: 'openai',
        model: AI_PROVIDER_PRESETS.openai.models[0].value,
        customModel: '',
        apiKey: ''
    };
}

function normalizeAiSettings(settings = {}) {
    const defaults = getDefaultAiSettings();
    const provider = AI_PROVIDER_PRESETS[settings.provider] ? settings.provider : defaults.provider;
    const presetModels = AI_PROVIDER_PRESETS[provider].models.map(model => model.value);
    const model = settings.model === 'custom' || presetModels.includes(settings.model)
        ? settings.model
        : AI_PROVIDER_PRESETS[provider].models[0].value;

    return {
        provider,
        model,
        customModel: String(settings.customModel || '').trim(),
        apiKey: String(settings.apiKey || '').trim()
    };
}

function loadAiSettings() {
    try {
        const rawSettings = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
        return normalizeAiSettings(rawSettings ? JSON.parse(rawSettings) : {});
    } catch {
        return getDefaultAiSettings();
    }
}

function saveAiSettings(settings) {
    const normalized = normalizeAiSettings(settings);
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}

function clearAiSettings() {
    window.localStorage.removeItem(AI_SETTINGS_STORAGE_KEY);
    return getDefaultAiSettings();
}

function resolveSelectedModel(settings) {
    if (settings.model === 'custom') {
        return settings.customModel;
    }
    return settings.model;
}

function hasUserApiKey(settings = loadAiSettings()) {
    return Boolean(settings.apiKey && resolveSelectedModel(settings));
}

/**
 * 논문 요약 서비스 클래스
 * 사용자 API 키는 브라우저 localStorage에 저장하고, 요약 요청 때만 서버리스 API로 전달합니다.
 */
class SummaryService {
    constructor() {
        this.statusCache = null;
    }

    async getStatus(forceRefresh = false) {
        const userSettings = loadAiSettings();
        const userConfigured = hasUserApiKey(userSettings);

        if (!userConfigured && this.statusCache && !forceRefresh) {
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

            const serverStatus = await response.json();

            if (userConfigured) {
                return {
                    ...serverStatus,
                    configured: true,
                    userConfigured: true,
                    provider: userSettings.provider,
                    model: resolveSelectedModel(userSettings),
                    cache: 'browser-api-key',
                    message: '사용자 API 키가 이 브라우저에 저장되어 있습니다.'
                };
            }

            this.statusCache = serverStatus;
            return serverStatus;
        } catch (error) {
            return {
                configured: userConfigured,
                unavailable: true,
                userConfigured,
                provider: userSettings.provider,
                model: userConfigured ? resolveSelectedModel(userSettings) : undefined,
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

        const aiSettings = loadAiSettings();
        const selectedModel = resolveSelectedModel(aiSettings);

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
                abstract: article.abstract,
                aiProvider: aiSettings.provider,
                aiModel: selectedModel,
                aiApiKey: aiSettings.apiKey
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

export {
    AI_PROVIDER_PRESETS,
    clearAiSettings,
    getOpenAISummary,
    getSummaryServiceStatus,
    hasUserApiKey,
    loadAiSettings,
    resolveSelectedModel,
    saveAiSettings,
    SummaryService
};
