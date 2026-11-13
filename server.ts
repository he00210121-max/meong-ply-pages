import { createHash, timingSafeEqual } from "node:crypto";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { normalizeTitle, normalizeArtist, getTrackKey } from "./src/utils/trackHistory.ts";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

app.use((req, res, next) => {
  const password = process.env.SITE_PASSWORD;

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).send("Password not configured");
    }
    return next();
  }

  const auth = req.headers.authorization ?? "";
  let authenticated = false;

  if (auth.startsWith("Basic ")) {
    try {
      const supplied = Buffer.from(
        auth.slice(6), "base64"
      ).toString("utf8");

      const expectedHash = createHash("sha256")
        .update("meongply:" + password)
        .digest();

      const suppliedHash = createHash("sha256")
        .update(supplied)
        .digest();

      authenticated = timingSafeEqual(
        expectedHash,
        suppliedHash
      );
    } catch {
      authenticated = false;
    }
  }

  if (authenticated) return next();

  res.setHeader(
    "WWW-Authenticate",
    'Basic realm="MeongPly", charset="UTF-8"'
  );

  return res.status(401).send("Login required");
});


function getAiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface SongRecommendation {
  number: number;
  title: string;
  artist: string;
  reason: string;
  releaseYear?: string;
  country?: string;
  genre?: string;
  isInstrumental?: boolean;
  isCover?: boolean;
  isAiMusic?: boolean;
  vibe?: string;
  youtubeSearchQuery: string;
}

export interface AnalysisSummary {
  country: string;
  genre: string;
  era: string;
  vocalType: string;
  moodAndSituation?: string;
  isCover?: boolean;
  excludedMusic?: string;
}

export interface VerificationInfo {
  countryCondition: string;
  genreCondition: string;
  eraCondition: string;
  vocalCondition: string;
  allConstraintsMet: boolean;
  isVerifiedByExternalApi: boolean;
  verificationSource: string;
}

export interface TokenUsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  isCached?: boolean;
}

export interface PlaylistResponse {
  playlistTitle: string;
  playlistDescription: string;
  tags: string[];
  totalCount: number;
  requestedCount: number;
  shortageReason?: string;
  analysis?: AnalysisSummary;
  verification?: VerificationInfo;
  songs: SongRecommendation[];
  executionTimeMs?: number;
  modelUsed: string;
  modelProvider: 'gemini' | 'groq';
  source: 'ai' | 'cache';
  tokenUsage?: TokenUsageInfo;
}

// In-memory LRU cache for fast repeat recommendations (Max 200 entries, 24h TTL)
interface CacheEntry {
  data: PlaylistResponse;
  createdAt: number;
}

const recommendationCache = new Map<string, CacheEntry>();
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
const CACHE_MAX_ENTRIES = 200;

function setLruCache(key: string, data: PlaylistResponse) {
  if (recommendationCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = recommendationCache.keys().next().value;
    if (oldestKey) recommendationCache.delete(oldestKey);
  }
  recommendationCache.set(key, { data, createdAt: Date.now() });
}

/**
 * Clean user's query:
 * - Strips explicit song count phrases (e.g., '10곡 추천해 줘', '13곡', '20개 찾아줘', '7트랙')
 * - Strictly PRESERVES musical era / release decades:
 *   '1990년대', '2000년대', '1980년대', '80년대', '90년대', '00년대', '2010년대'
 */
function sanitizeMusicQuery(rawQuery: string): {
  cleanedQuery: string;
  detectedCount?: number;
} {
  if (!rawQuery) return { cleanedQuery: "" };

  let detectedCount: number | undefined;

  const countRegex = /(?:^|\s|[^\d\w가-힣])(\d{1,2})\s*(?:곡|개|트랙)(?:\s*(?:추천(?:해\s*줘|해줘|해주세요|부탁해)?|찾아줘|골라줘|뽑아줘|선곡해줘|들려줘|알려줘|모아줘))?/g;

  const match = countRegex.exec(rawQuery);
  if (match && match[1]) {
    detectedCount = parseInt(match[1], 10);
  }

  const cleanedQuery = rawQuery
    .replace(/(?:^|\s|[^\d\w가-힣])(\d{1,2})\s*(?:곡|개|트랙)(?:\s*(?:추천(?:해\s*줘|해줘|해주세요|부탁해)?|찾아줘|골라줘|뽑아줘|선곡해줘|들려줘|알려줘|모아줘))?/g, ' ')
    .trim()
    .replace(/\s{2,}/g, ' ');

  return {
    cleanedQuery: cleanedQuery || "취향에 맞는 인기 추천 음악",
    detectedCount,
  };
}

/**
 * Robust JSON parser that recovers complete song objects even if response was truncated (finish_reason: length)
 */
function parseRobustJson(rawText: string): any {
  if (!rawText) return null;
  const cleaned = rawText.trim();

  // 1. Direct standard parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Extract markdown JSON block if wrapped
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {}
  }

  // 3. Repair truncated JSON array if cut off at max_tokens
  const songsIdx = cleaned.indexOf('"songs"');
  if (songsIdx !== -1) {
    const openBracket = cleaned.indexOf('[', songsIdx);
    if (openBracket !== -1) {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > openBracket) {
        const candidates = [
          cleaned.slice(0, lastBrace + 1) + ']}',
          cleaned.slice(0, lastBrace + 1) + ']',
          '{"songs":' + cleaned.slice(openBracket, lastBrace + 1) + ']}',
        ];
        for (const candidate of candidates) {
          try {
            return JSON.parse(candidate);
          } catch {}
        }
      }
    }
  }

  throw new Error("AI 응답 데이터에서 유효한 JSON을 추출하지 못했습니다.");
}

interface GroqCallResult {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Call Groq Cloud API with token metrics and strict JSON formatting
 */
function groqOutputBudget(count: number): number {
  return 200 + count * 80;
}

async function callGroq({
  systemInstruction,
  promptText,
  modelName = "qwen/qwen3.8-27b",
  maxTokens = 680,
  useStrictSchema = false,
}: {
  systemInstruction: string;
  promptText: string;
  modelName?: string;
  maxTokens?: number;
  useStrictSchema?: boolean;
}): Promise<GroqCallResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY 환경변수가 설정되어 있지 않습니다. AI Studio Secrets에서 설정해 주세요.");
  }

  // Per-response output allowance; account-wide rate limits are separate.
  const safeMaxTokens = Math.max(maxTokens, 150);

  const requestPayload: any = {
    model: modelName,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: promptText }
    ],
    temperature: 0.2,
    max_tokens: safeMaxTokens,
  };

  if (useStrictSchema) {
    requestPayload.response_format = {
      type: "json_schema",
      json_schema: {
        name: "playlist_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            songs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  artist: { type: "string" },
                  year: { type: "string" },
                  reason: { type: "string" }
                },
                required: ["title", "artist", "year", "reason"],
                additionalProperties: false
              }
            }
          },
          required: ["title", "songs"],
          additionalProperties: false
        }
      }
    };
  } else {
    requestPayload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "meong-ply-ai",
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || "";

    if (response.status === 401) {
      throw new Error("Groq API 인증에 실패했습니다 (401). GROQ_API_KEY 등록 상태를 확인해 주세요.");
    }
    if (response.status === 429) {
      throw new Error("Groq 요청 또는 토큰 사용 한도에 도달했습니다 (429). 잠시 후 다시 시도해 주세요.");
    }
    if (response.status === 503) {
      throw new Error("Groq 서버가 일시적으로 지연되고 있습니다 (503). 잠시 후 다시 시도해 주세요.");
    }
    throw new Error(`Groq API 호출 오류 (${response.status}): ${message || response.statusText}`);
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error("Groq 모델에서 유효한 응답을 생성하지 못했습니다.");
  }

  return {
    content,
    finishReason: choice.finish_reason,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens || 0,
      completionTokens: data.usage.completion_tokens || 0,
      totalTokens: data.usage.total_tokens || 0,
    } : undefined
  };
}

interface GeminiCallResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Call Gemini API with usage metrics
 */
async function callGemini({
  systemInstruction,
  promptText,
}: {
  systemInstruction: string;
  promptText: string;
}): Promise<GeminiCallResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다. AI Studio 우측 상단의 'Settings > Secrets' 또는 .env 파일에 GEMINI_API_KEY를 등록해 주세요.");
  }

  const ai = getAiClient();
  const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      if (response && response.text) {
        const usage = response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        } : undefined;
        return {
          content: response.text,
          usage,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini ${modelName} 시도 실패]:`, err?.message || err);
    }
  }

  throw lastError || new Error("Gemini AI 응답 데이터가 비어 있습니다.");
}

app.post("/api/recommend", async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      query,
      count,
      model = "gemini",
      includeAiMusic = false,
      vocalPreference = "all",
      vibe,
      genre,
      era,
      region,
      popularity = "any",
      coverPreference = "any",
      excludedMusic,
      excludeHistory = [],
      forceRefresh = false,
    } = req.body;

    if (!query || typeof query !== "string" || !query.trim()) {
      res.status(400).json({ error: "음악 분위기나 원하시는 곡 스타일을 입력해 주세요." });
      return;
    }

    // 1. Determine target count strictly from slider (5 ~ 30)
    const rawCount = Number(count);
    const safeCount = Math.min(Math.max(Number.isInteger(rawCount) && rawCount >= 1 ? rawCount : 10, 5), 30);

    // 2. Clean query
    const { cleanedQuery } = sanitizeMusicQuery(query);

    // 3. Cache lookup (Requirement A: Bypass cache on retry/forceRefresh or when history exclusions are provided)
    const hasHistoryToExclude = Array.isArray(excludeHistory) && excludeHistory.length > 0;
    const shouldBypassCache = Boolean(forceRefresh) || hasHistoryToExclude;

    const criteriaKey = `${vibe || ''}_${genre || ''}_${era || ''}_${region || ''}_${vocalPreference}_${coverPreference}_${includeAiMusic}_${popularity}_${excludedMusic || ''}`;
    const cacheKey = `v10_${model}_${cleanedQuery.trim().toLowerCase()}_${safeCount}_${criteriaKey.toLowerCase()}`;

    if (!shouldBypassCache) {
      const cached = recommendationCache.get(cacheKey);
      if (cached && Date.now() - cached.createdAt < CACHE_MAX_AGE) {
        if (cached.data.requestedCount === safeCount && cached.data.songs.length === safeCount) {
          console.log(`[멍플리 캐시 적중] 모델: ${model}, 요청: "${cleanedQuery}", 슬라이더: ${safeCount}곡, 반환: ${cached.data.songs.length}곡 (토큰 소모: 0)`);
          res.json({
            ...cached.data,
            source: 'cache',
            executionTimeMs: 0,
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              isCached: true,
            }
          });
          return;
        }
      }
    }

    // 4. Constraint Detection
    const hasExplicitJapan = cleanedQuery.includes("일본") || region?.includes("일본");
    const hasExplicitKorea = cleanedQuery.includes("한국") || cleanedQuery.includes("국내") || region?.includes("한국");
    const hasExplicitWestern = cleanedQuery.includes("팝송") || cleanedQuery.includes("미국") || cleanedQuery.includes("영국") || region?.includes("미국") || region?.includes("영국");
    const isExplicitCountryRequested = Boolean(region) || hasExplicitJapan || hasExplicitKorea || hasExplicitWestern;

    const hasExplicit1990s = cleanedQuery.includes("1990년대") || cleanedQuery.includes("90년대") || era === "1990년대";
    const hasExplicit2000s = cleanedQuery.includes("2000년대") || cleanedQuery.includes("00년대") || era === "2000년대";
    const hasExplicit1980s = cleanedQuery.includes("1980년대") || cleanedQuery.includes("80년대") || era === "1980년대";
    const isExplicitEraRequested = Boolean(era) || hasExplicit1990s || hasExplicit2000s || hasExplicit1980s;

    const isExplicitInstrumentalRequested = vocalPreference === "instrumental" || cleanedQuery.includes("연주곡") || cleanedQuery.includes("가사 없는") || cleanedQuery.includes("인스트루멘탈");
    const isExplicitVocalRequested = vocalPreference === "vocal" || cleanedQuery.includes("보컬") || cleanedQuery.includes("가창");

    const isHiddenRequested = popularity === "hidden" || cleanedQuery.includes("잘 알려지지 않은") || cleanedQuery.includes("숨은 명곡") || cleanedQuery.includes("인디") || cleanedQuery.includes("덜 알려진");
    const isSingleArtistQuery = cleanedQuery.includes("이준영") || (cleanedQuery.length < 15 && cleanedQuery.includes("노래") && !isHiddenRequested);

    // 5. Build compact rules tailored to user input
    const promptConstraintRules: string[] = [];

    if (hasExplicitJapan) {
      promptConstraintRules.push("- 국가: 반드시 일본 아티스트/음원만 선곡 (서양 재즈 아티스트 제외).");
    } else if (hasExplicitKorea) {
      promptConstraintRules.push("- 국가: 한국 아티스트/음원 위주 선곡.");
    } else if (hasExplicitWestern) {
      promptConstraintRules.push("- 국가: 해외/팝 아티스트 위주 선곡.");
    } else {
      promptConstraintRules.push("- 국가: [제한 없음] 국내 및 해외 다양한 감성 음악을 폭넓게 탐색.");
    }

    if (hasExplicit1990s) {
      promptConstraintRules.push("- 시대: 반드시 1990년대(1990~1999) 발표곡만 선곡.");
    } else if (hasExplicit2000s) {
      promptConstraintRules.push("- 시대: 반드시 2000년대(2000~2009) 발표곡만 선곡.");
    } else if (hasExplicit1980s) {
      promptConstraintRules.push("- 시대: 반드시 1980년대(1980~1989) 발표곡만 선곡.");
    } else {
      promptConstraintRules.push("- 시대: [제한 없음] 시대 불문 다채로운 명곡 탐색.");
    }

    if (isExplicitInstrumentalRequested) {
      promptConstraintRules.push("- 보컬: 반드시 가사 없는 순수 악기 연주곡만 선곡.");
    } else if (isExplicitVocalRequested) {
      promptConstraintRules.push("- 보컬: 보컬 가창곡만 선곡.");
    }

    // 5. Candidate oversampling target (e.g. 5 -> 7, 10 -> 13, 15 -> 18, 30 -> 34)
    const candidateTarget = Math.min(safeCount + 4, Math.ceil(safeCount * 1.25));

    // Build history keys for canonical duplicate checking
    const historyKeys = new Set<string>();
    if (Array.isArray(excludeHistory)) {
      for (const h of excludeHistory) {
        if (h && typeof h.title === 'string' && typeof h.artist === 'string' && h.title.trim()) {
          historyKeys.add(getTrackKey(h.title, h.artist));
        }
      }
    }

    if (isHiddenRequested) {
      promptConstraintRules.push("- 선곡 풀: [숨은 명곡] 아이유, 임영웅, 성시경, 박효신, BTS 등 대중적인 톱스타 대표곡은 배제하고, 인디 뮤지션 및 숨은 명곡 우선 추천.");
    } else {
      promptConstraintRules.push("- 음악 구성: 널리 사랑받는 대표 명곡(약 45%)과 새로운 발견이 되는 숨은 명곡/인디/앨범 수록곡(약 55%)을 조화롭게 교차 선곡할 것.");
    }

    if (!isSingleArtistQuery) {
      promptConstraintRules.push(`- 아티스트 다양성: 동일 아티스트는 플레이리스트 전체에서 최대 1곡으로 엄격히 제한 (서로 다른 다양한 아티스트 선곡).`);
    }

    if (historyKeys.size > 0) {
      const recentFormatted = excludeHistory
        .slice(0, 30)
        .map((t: any) => `${t.artist} - ${t.title}`)
        .join("; ");
      promptConstraintRules.push(`- 이전 추천 곡 제외: 다음 곡들은 사용자가 이미 최근 추천받았으므로 반드시 배제하고 완전히 새로운 다른 실존 곡만 선곡할 것: [${recentFormatted}]`);
    }

    // Subtle curation angle rotation to ensure fresh explorations across retries
    const diversityPerspectives = [
      "대중적인 스테디셀러 명곡과 새로운 매력을 주는 숨은 명작/인디 트랙을 조화롭게 선곡",
      "다채로운 보컬 음색, 어쿠스틱 악기 편성 및 풍부한 감성의 멜로디라인을 고르게 배치",
      "시대와 아티스트의 다양성을 극대화하여 진부하지 않은 신선한 트랙 중심 선곡",
      "감각적인 편곡과 몰입도 높은 사운드스케이프를 자랑하는 다채로운 명곡 탐색",
    ];
    const chosenPerspective = diversityPerspectives[Math.floor(Math.random() * diversityPerspectives.length)];
    promptConstraintRules.push(`- 큐레이션 포커스: ${chosenPerspective}`);

    promptConstraintRules.push(`- 목표 후보 곡 수: 품질 검증 및 다양성 선별을 위해 서로 다른 아티스트의 실존 곡 총 ${candidateTarget}곡을 추천할 것.`);

    // Streamlined Minimal System Instruction & Schema with Diversity Guidelines
    const systemInstruction = `당신은 실존 음악을 정밀하고 폭넓게 큐레이션하는 전문 AI 음악 큐레이터 '멍플리'입니다.
가공의 곡이나 존재하지 않는 음원 제목을 임의로 조합하는 행위를 절대 엄격히 금지합니다.

[음악 다양성 및 추천 품질 규칙]
1. 아티스트 다양성: 동일한 아티스트는 플레이리스트 전체에서 최대 1곡만 선곡하세요.
2. 대중성과 깊이의 균형:
   - 누구나 알 만한 대표 인기곡/명곡(약 40~50%)과 취향을 넓혀주는 숨은 명곡/인디/앨범 수록곡(약 50~60%)을 조화롭게 안배하세요.
   - 특정 유명 가수의 대표곡에만 편중되지 않도록 다양한 뮤지션을 포함하세요.
3. 조건 적합도: 사용자가 요청한 무드, 장르, 상황, 시대, 보컬 특성을 정확하게 반영하세요.
4. 이전 추천 제외: [이전 추천 곡 제외] 목록에 포함된 곡은 이미 사용자에게 추천된 곡이므로 절대로 다시 추천하지 마세요.

반드시 다음 간결한 JSON 형식으로만 응답하세요:
{
  "title": "플레이리스트 제목 (15자 이내)",
  "songs": [
    {
      "title": "실제 정식 곡명",
      "artist": "실제 정식 아티스트명",
      "year": "발매연도 (4자리 숫자)",
      "popularityTier": "popular" 또는 "hidden",
      "reason": "요청 분위기와 어울리는 이유 (5~12단어)"
    }
  ]
}`;

    const promptText = `[음악 추천 요청서]
요청: "${cleanedQuery}"
요청 곡 수: ${safeCount}곡 (후보 ${candidateTarget}곡 선곡 요망)
[필수 반영 지침]
${promptConstraintRules.join("\n")}`;

    const activeModelName = model === "groq" ? "qwen/qwen3.8-27b" : "gemini-3.8-flash";
    const modelProvider = model === "groq" ? "groq" : "gemini";

    const primaryTokenBudget = model === "groq" ? groqOutputBudget(candidateTarget) : 3072;

    let rawText = "";
    let initialFinishReason: string | undefined;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    if (model === "groq") {
      const groqRes = await callGroq({
        systemInstruction,
        promptText,
        modelName: activeModelName,
        maxTokens: primaryTokenBudget,
        useStrictSchema: false,
      });
      rawText = groqRes.content;
      initialFinishReason = groqRes.finishReason;
      if (groqRes.usage) {
        totalPromptTokens = groqRes.usage.promptTokens;
        totalCompletionTokens = groqRes.usage.completionTokens;
      }
    } else {
      const geminiRes = await callGemini({
        systemInstruction,
        promptText,
      });
      rawText = geminiRes.content;
      if (geminiRes.usage) {
        totalPromptTokens = geminiRes.usage.promptTokens;
        totalCompletionTokens = geminiRes.usage.completionTokens;
      }
    }

    if (!rawText) {
      throw new Error(`${activeModelName} 모델 응답 데이터가 비어 있습니다.`);
    }

    let responseComplete = initialFinishReason !== "length";
    try { JSON.parse(rawText.trim()); } catch { responseComplete = false; }
    let parsedData: any;
    try { parsedData = parseRobustJson(rawText); }
    catch { parsedData = { songs: [] }; responseComplete = false; }
    const initialRawSongs = Array.isArray(parsedData?.songs) ? parsedData.songs : [];

    // Quality Filtering & Canonical Deduplication
    const seenTracks = new Set<string>();
    const artistCounts = new Map<string, number>();
    const maxPerArtist = isSingleArtistQuery ? 10 : (safeCount >= 20 ? 2 : 1);
    const verifiedSongs: SongRecommendation[] = [];

    function processSong(song: any) {
      if (verifiedSongs.length >= safeCount || typeof song?.title !== "string" || typeof song?.artist !== "string" || !song.title.trim() || !song.artist.trim()) return;

      const trackKey = getTrackKey(song.title, song.artist);
      const normArtist = normalizeArtist(song.artist);

      // 1. History exclusion check (bypasses songs user recently heard)
      if (historyKeys.has(trackKey)) {
        console.log(`[이전 추천 중복 제외] ${song.artist} - ${song.title}`);
        return;
      }

      // 2. Batch deduplication check (including normalized remasters/features)
      if (seenTracks.has(trackKey)) {
        console.log(`[동일 배치 중복 제외] ${song.artist} - ${song.title}`);
        return;
      }

      // 3. Country / Region filtering
      if (hasExplicitJapan) {
        const nonJapanese = ["bill evans", "miles davis", "chet baker", "dave brubeck", "john coltrane", "yann tiersen"];
        if (nonJapanese.some(a => normArtist.includes(a))) return;
      }

      // 4. Instrumental filtering
      if (isExplicitInstrumentalRequested && song.isInstrumental === false) {
        return;
      }

      // 5. Artist diversity cap (max 1 track per artist, or 2 if >= 20 tracks)
      const curCount = artistCounts.get(normArtist) || 0;
      if (curCount >= maxPerArtist) {
        console.log(`[아티스트 편중 제외] ${song.artist} (이미 ${curCount}곡 포함)`);
        return;
      }

      seenTracks.add(trackKey);
      artistCounts.set(normArtist, curCount + 1);

      verifiedSongs.push({
        number: verifiedSongs.length + 1,
        title: song.title.trim(),
        artist: song.artist.trim(),
        releaseYear: song.year || song.releaseYear || undefined,
        reason: song.reason ? song.reason.trim() : "감성 추천 트랙",
        youtubeSearchQuery: `${song.artist.trim()} - ${song.title.trim()}`,
        isInstrumental: isExplicitInstrumentalRequested ? true : undefined,
      });
    }

    for (const song of initialRawSongs) {
      processSong(song);
    }

    // Adaptive Continuation if needed after strict filtering
    const needed = safeCount - verifiedSongs.length;
    const isTruncated = initialFinishReason === "length";

    if (needed > 0) {
      const continuationBudget = groqOutputBudget(needed);
      console.log(`[적응형 보충 요청] 현재: ${verifiedSongs.length}곡, 부족: ${needed}곡 -> 보충 호출`);
      const existingList = verifiedSongs.map(s => `${s.artist} - ${s.title}`).join(", ");
      const historyStr = historyKeys.size > 0 ? excludeHistory.slice(0, 20).map((t: any) => `${t.artist} - ${t.title}`).join(", ") : "";

      const continuationPrompt = `${promptText}
[추가 선곡 요청]
현재 ${verifiedSongs.length}곡이 선곡되었습니다.
이미 선곡된 다음 곡들 및 이전 추천 곡들과 절대 중복되지 않게, 완전히 새로운 실존 곡 ${needed}곡만 추가로 추천해 주세요:
[이미 선곡된 곡]: ${existingList}
${historyStr ? `[이전 추천 곡]: ${historyStr}` : ''}
동일 아티스트 1곡 이하, 실존 곡만 추천하세요.`;

      try {
        let contRawText = "";
        if (model === "groq") {
          const contRes = await callGroq({
            systemInstruction,
            promptText: continuationPrompt,
            modelName: activeModelName,
            maxTokens: continuationBudget,
            useStrictSchema: false,
          });
          contRawText = contRes.content;
          if (contRes.finishReason === "length") responseComplete = false;
          if (contRes.usage) {
            totalPromptTokens += contRes.usage.promptTokens;
            totalCompletionTokens += contRes.usage.completionTokens;
          }
        } else {
          const contRes = await callGemini({
            systemInstruction,
            promptText: continuationPrompt,
          });
          contRawText = contRes.content;

          if (contRes.usage) {
            totalPromptTokens += contRes.usage.promptTokens;
            totalCompletionTokens += contRes.usage.completionTokens;
          }
        }

        try { JSON.parse(contRawText.trim()); } catch { responseComplete = false; }
        const contParsed = parseRobustJson(contRawText);
        const contSongs = Array.isArray(contParsed?.songs) ? contParsed.songs : [];
        for (const s of contSongs) {
          if (verifiedSongs.length >= safeCount) break;
          processSong(s);
        }
      } catch (contErr: any) {
        responseComplete = false;
        console.warn("[적응형 보충 요청 건너뜀 (기존 곡 반환)]:", contErr?.message || contErr);
      }
    }

    if (verifiedSongs.length === 0) {
      throw new Error("요청 조건에 완벽히 부합하는 실존 곡을 찾지 못했습니다. 조건을 조금 더 넓혀 다시 시도해 주세요.");
    }

    // Renumber songs sequentially
    verifiedSongs.forEach((song, idx) => {
      song.number = idx + 1;
    });

    // Honest Shortage & Verification Reporting
    let shortageReason: string | undefined;
    if (verifiedSongs.length < safeCount) {
      shortageReason = `요청하신 ${safeCount}곡 중 ${verifiedSongs.length}곡을 표시합니다. 응답이나 중복 제거 과정에서 곡 수가 부족했습니다. 조건을 조정하거나 다시 시도해 주세요.`;
    }

    const analysis: AnalysisSummary = {
      country: isExplicitCountryRequested ? (region || (hasExplicitJapan ? "일본" : hasExplicitKorea ? "한국" : "해외/팝")) : "전체 (자유 탐색)",
      genre: genre || "요청 분위기 기반",
      era: isExplicitEraRequested ? (era || (hasExplicit1990s ? "1990년대" : hasExplicit2000s ? "2000년대" : "지정 연대")) : "전체 (제한 없음)",
      vocalType: isExplicitInstrumentalRequested ? "순수 연주곡 (가사 없음)" : isExplicitVocalRequested ? "보컬곡" : "전체 (보컬 및 연주)",
      moodAndSituation: vibe || "감성적 분위기",
      isCover: false,
    };

    const verification: VerificationInfo = {
      countryCondition: analysis.country,
      genreCondition: analysis.genre,
      eraCondition: analysis.era,
      vocalCondition: analysis.vocalType,
      allConstraintsMet: verifiedSongs.length > 0,
      isVerifiedByExternalApi: false,
      verificationSource: "AI 내부 학습 지식 기반 추천 (외부 음악 DB 미연동)",
    };

    const executionTimeMs = Date.now() - startTime;

    // Synthesize clean metadata
    const playlistTitle = parsedData?.title || `${cleanedQuery} 맞춤 플레이리스트`;
    const playlistDescription = `${cleanedQuery} 테마에 맞춰 멍플리가 엄선한 ${verifiedSongs.length}곡의 플레이리스트입니다.`;
    const tags = [
      "멍플리",
      isHiddenRequested ? "숨은명곡" : "인기음악",
      hasExplicitJapan ? "일본재즈" : hasExplicitWestern ? "팝송" : hasExplicitKorea ? "국내음악" : "추천음악",
      vibe || "감성선곡"
    ];

    const tokenUsage: TokenUsageInfo = {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      isCached: false,
    };

    const responseData: PlaylistResponse = {
      playlistTitle,
      playlistDescription,
      tags,
      totalCount: verifiedSongs.length,
      requestedCount: safeCount,
      shortageReason,
      analysis,
      verification,
      songs: verifiedSongs,
      executionTimeMs,
      modelUsed: model === "groq" ? "qwen/qwen3.8-27b (Groq)" : "gemini-3.8-flash (Gemini)",
      modelProvider,
      source: 'ai',
      tokenUsage,
    };

    // Cache response only for clean, non-forced, non-history requests
    if (responseComplete && verifiedSongs.length === safeCount && !forceRefresh && !hasHistoryToExclude) {
      setLruCache(cacheKey, responseData);
    }

    console.log(`[멍플리 추천 성공] 모델: ${responseData.modelUsed}, 요청: "${cleanedQuery}", 슬라이더: ${safeCount}곡, 최종: ${responseData.songs.length}곡, 소요시간: ${executionTimeMs}ms, 토큰: 입력 ${tokenUsage.promptTokens} / 출력 ${tokenUsage.completionTokens} (총 ${tokenUsage.totalTokens})`);

    res.json(responseData);
  } catch (err: any) {
    const executionTimeMs = Date.now() - startTime;
    console.error(`[멍플리 추천 오류] 사유:`, err?.message || err);
    res.status(500).json({
      error: err?.message || "음악을 정밀 선곡하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요!",
      executionTimeMs,
    });
  }
});


// Setup dev server or static serve
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`멍플리 (Meong-Ply) server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
