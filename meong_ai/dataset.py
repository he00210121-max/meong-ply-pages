"""
MeongAI 1.0 Dataset Loader & Data Integrity Validator
- 음악 카탈로그(catalog.json)와 인터랙션 데이터(interactions.json) 검증
- 결측치 및 비정상 데이터 사전 차단
- 범주형 태그 인덱스 매핑 및 연속형 오디오 피처 정규화
"""

import json
import os
from typing import Dict, List, Tuple, Any

try:
    import torch
    from torch.utils.data import Dataset
except ImportError:
    # PyTorch가 설치되지 않은 환경에서도 데이터 검증 단독 실행 가능하도록 예외 처리
    torch = None
    Dataset = object

# 고정 어휘 사전 정의 (카탈로그 및 사용자 입력과 일치)
VOCAB_MOODS = [
    "UNKNOWN", "잔잔한 & 나른한", "신나는 & 활기찬", "새벽 감성 & 몽환적",
    "가사 없는 차분한", "따뜻한 위로 & 힐링", "그루브 넘치는"
]

VOCAB_SITUATIONS = [
    "UNKNOWN", "공부할 때", "밤에 잠들기 전", "비 오는 날",
    "운동할 때", "새벽에 드라이브할 때", "카페에서 작업할 때", "조용히 책 읽을 때"
]

VOCAB_GENRES = [
    "UNKNOWN", "팝", "인디 / 어쿠스틱", "재즈", "피아노 연주곡",
    "일본 시티팝", "K-POP", "R&B / 소울", "로파이 (Lo-Fi)", "힙합 (Hip-Hop)"
]

VOCAB_ERAS = [
    "UNKNOWN", "1950년대", "1960년대", "1970년대", "1980년대",
    "1990년대", "2000년대", "2010년대", "2020년대 최신"
]

VOCAB_REGIONS = [
    "UNKNOWN", "한국", "일본", "미국", "영국", "프랑스", "캐나다", "이탈리아"
]

VOCAB_VOCALS = [
    "all", "vocal", "instrumental"
]

def map_year_to_era(year_str: str) -> str:
    try:
        y = int(year_str)
        if y < 1960: return "1950년대"
        elif y < 1970: return "1960년대"
        elif y < 1980: return "1970년대"
        elif y < 1990: return "1980년대"
        elif y < 1990: return "1980년대"
        elif y < 2000: return "1990년대"
        elif y < 2010: return "2000년대"
        elif y < 2020: return "2010년대"
        else: return "2020년대 최신"
    except:
        return "UNKNOWN"

def get_vocab_index(vocab_list: List[str], val: str) -> int:
    val = (val or "").strip()
    if val in vocab_list:
        return vocab_list.index(val)
    # 부분 일치 탐색
    for i, v in enumerate(vocab_list):
        if v != "UNKNOWN" and (v in val or val in v):
            return i
    return 0

class MusicCatalogValidator:
    @staticmethod
    def validate_catalog(catalog_path: str) -> Dict[str, Dict[str, Any]]:
        if not os.path.exists(catalog_path):
            raise FileNotFoundError(f"카탈로그 파일을 찾을 수 없습니다: {catalog_path}")

        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog_list = json.load(f)

        if not isinstance(catalog_list, list) or len(catalog_list) == 0:
            raise ValueError("카탈로그는 비어 있지 않은 JSON 리스트여야 합니다.")

        catalog_dict = {}
        for idx, item in enumerate(catalog_list):
            required_keys = ["id", "title", "artist", "releaseYear", "genre"]
            for k in required_keys:
                if k not in item or not item[k]:
                    raise ValueError(f"곡 #{idx}에 필수 키 '{k}'가 누락되었습니다: {item}")
            
            # 수치형 피처 정합성 검증 (0.0 ~ 1.0 범위)
            energy = float(item.get("energy", 0.5))
            valence = float(item.get("valence", 0.5))
            tempo = float(item.get("tempo", 100.0))
            acousticness = float(item.get("acousticness", 0.5))
            popularity = float(item.get("popularity", 80.0))

            if not (0.0 <= energy <= 1.0) or not (0.0 <= valence <= 1.0):
                raise ValueError(f"곡 '{item['title']}'의 energy 또는 valence 범주 오류 (0.0~1.0): energy={energy}, valence={valence}")

            catalog_dict[item["id"]] = item

        print(f"[검증 완료] 실존 음악 카탈로그 {len(catalog_dict)}곡 무결성 확인 성공.")
        return catalog_dict

    @staticmethod
    def validate_interactions(interactions_path: str, catalog_dict: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not os.path.exists(interactions_path):
            raise FileNotFoundError(f"인터랙션 데이터 파일을 찾을 수 없습니다: {interactions_path}")

        with open(interactions_path, "r", encoding="utf-8") as f:
            interactions = json.load(f)

        valid_list = []
        for idx, entry in enumerate(interactions):
            song_id = entry.get("songId")
            if song_id not in catalog_dict:
                raise ValueError(f"인터랙션 #{idx}의 songId '{song_id}'가 음악 카탈로그에 존재하지 않습니다!")
            
            label = float(entry.get("label", 0.0))
            if label not in (0.0, 1.0):
                raise ValueError(f"인터랙션 #{idx}의 label은 0.0 또는 1.0이어야 합니다: {label}")
            
            valid_list.append(entry)

        print(f"[검증 완료] 학습용 인터랙션 데이터 {len(valid_list)}건 검증 성공.")
        return valid_list

if torch is not None:
    class MeongRecommendationDataset(Dataset):
        def __init__(self, interactions: List[Dict[str, Any]], catalog_dict: Dict[str, Dict[str, Any]]):
            self.samples = []

            for entry in interactions:
                ctx = entry.get("context", {})
                song = catalog_dict[entry["songId"]]

                # User Context Feats
                u_m = get_vocab_index(VOCAB_MOODS, ctx.get("mood", ""))
                u_s = get_vocab_index(VOCAB_SITUATIONS, ctx.get("situation", ""))
                u_g = get_vocab_index(VOCAB_GENRES, ctx.get("genre", ""))
                u_e = get_vocab_index(VOCAB_ERAS, ctx.get("era", ""))
                u_r = get_vocab_index(VOCAB_REGIONS, ctx.get("region", ""))
                u_v = get_vocab_index(VOCAB_VOCALS, ctx.get("vocal", "all"))

                # Song Feats
                s_g = get_vocab_index(VOCAB_GENRES, song.get("genre", ""))
                song_era = map_year_to_era(song.get("releaseYear", "2000"))
                s_e = get_vocab_index(VOCAB_ERAS, song_era)
                s_r = get_vocab_index(VOCAB_REGIONS, song.get("country", ""))

                energy = float(song.get("energy", 0.5))
                valence = float(song.get("valence", 0.5))
                tempo_norm = min(max(float(song.get("tempo", 100.0)) / 200.0, 0.0), 1.0)
                acousticness = float(song.get("acousticness", 0.5))
                popularity_norm = min(max(float(song.get("popularity", 80.0)) / 100.0, 0.0), 1.0)
                is_inst = 1.0 if song.get("isInstrumental", False) else 0.0

                audio_vec = [energy, valence, tempo_norm, acousticness, popularity_norm, is_inst]
                label = float(entry.get("label", 1.0))

                self.samples.append({
                    "user": {
                        "mood": torch.tensor(u_m, dtype=torch.long),
                        "situation": torch.tensor(u_s, dtype=torch.long),
                        "genre": torch.tensor(u_g, dtype=torch.long),
                        "era": torch.tensor(u_e, dtype=torch.long),
                        "region": torch.tensor(u_r, dtype=torch.long),
                        "vocal": torch.tensor(u_v, dtype=torch.long),
                    },
                    "song": {
                        "genre": torch.tensor(s_g, dtype=torch.long),
                        "era": torch.tensor(s_e, dtype=torch.long),
                        "region": torch.tensor(s_r, dtype=torch.long),
                        "audio_features": torch.tensor(audio_vec, dtype=torch.float32),
                    },
                    "label": torch.tensor(label, dtype=torch.float32)
                })

        def __len__(self):
            return len(self.samples)

        def __getitem__(self, idx):
            return self.samples[idx]

def collate_fn(batch):
    import torch
    user_batch = {
        k: torch.stack([b["user"][k] for b in batch]) for k in batch[0]["user"]
    }
    song_batch = {
        k: torch.stack([b["song"][k] for b in batch]) for k in batch[0]["song"]
    }
    labels = torch.stack([b["label"] for b in batch])
    return user_batch, song_batch, labels
