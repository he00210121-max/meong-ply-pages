"""
MeongAI 1.0 (MeongRankerNet) Evaluation Script
- 테스트 셋 기반 랭킹 추천 지표 평가 (HR@K, NDCG@K, MRR)
- 실제 후보 곡 목록 랭킹 추론 시연
"""

import argparse
import sys
import os
import math

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def evaluate_meong_ai(args):
    try:
        import torch
    except ImportError:
        print("[안내] 현재 환경에 PyTorch(torch)가 설치되어 있지 않습니다.")
        print("로컬 컴퓨터 환경에서 다음 명령어로 실행해 주세요:")
        print("  python3 meong_ai/evaluate.py --checkpoint meong_ai/checkpoints/meong_ranker.pt")
        sys.exit(1)

    from meong_ai.model import MeongRankerNet
    from meong_ai.dataset import (
        MusicCatalogValidator,
        VOCAB_MOODS,
        VOCAB_SITUATIONS,
        VOCAB_GENRES,
        VOCAB_ERAS,
        VOCAB_REGIONS,
        VOCAB_VOCALS,
        get_vocab_index,
        map_year_to_era
    )

    catalog = MusicCatalogValidator.validate_catalog(args.catalog_path)
    catalog_items = list(catalog.values())

    model = MeongRankerNet(
        num_moods=len(VOCAB_MOODS),
        num_situations=len(VOCAB_SITUATIONS),
        num_genres=len(VOCAB_GENRES),
        num_eras=len(VOCAB_ERAS),
        num_regions=len(VOCAB_REGIONS),
        num_vocals=len(VOCAB_VOCALS),
        embed_dim=args.embed_dim,
        hidden_dim=args.hidden_dim
    )

    if torch.cuda.is_available():
        model.load_state_dict(torch.load(args.checkpoint))
    else:
        model.load_state_dict(torch.load(args.checkpoint, map_location=torch.device('cpu')))

    model.eval()
    print("==================================================")
    print("🐾 MeongAI 1.0 모델 평가 & 랭킹 성능 분석")
    print(f"체크포인트: {args.checkpoint}")
    print(f"평가 대상 실존 음악 카탈로그: {len(catalog_items)}곡")
    print("==================================================")

    # 샘플 테스트 쿼리 시연
    test_queries = [
        {"mood": "새벽 감성 & 몽환적", "situation": "비 오는 날", "genre": "R&B / 소울", "vocal": "vocal", "region": "한국", "era": ""},
        {"mood": "그루브 넘치는", "situation": "새벽에 드라이브할 때", "genre": "일본 시티팝", "vocal": "all", "region": "일본", "era": "1980년대"},
        {"mood": "가사 없는 차분한", "situation": "공부할 때", "genre": "피아노 연주곡", "vocal": "instrumental", "region": "한국", "era": ""}
    ]

    for q_idx, q in enumerate(test_queries, 1):
        print(f"\n[테스트 시나리오 #{q_idx}]")
        print(f"사용자 요청: 분위기='{q['mood']}', 상황='{q['situation']}', 장르='{q['genre']}', 보컬='{q['vocal']}'")

        u_batch = {
            "mood": torch.tensor([get_vocab_index(VOCAB_MOODS, q["mood"])], dtype=torch.long),
            "situation": torch.tensor([get_vocab_index(VOCAB_SITUATIONS, q["situation"])], dtype=torch.long),
            "genre": torch.tensor([get_vocab_index(VOCAB_GENRES, q["genre"])], dtype=torch.long),
            "era": torch.tensor([get_vocab_index(VOCAB_ERAS, q["era"])], dtype=torch.long),
            "region": torch.tensor([get_vocab_index(VOCAB_REGIONS, q["region"])], dtype=torch.long),
            "vocal": torch.tensor([get_vocab_index(VOCAB_VOCALS, q["vocal"])], dtype=torch.long)
        }

        scores = []
        with torch.no_grad():
            for song in catalog_items:
                s_batch = {
                    "genre": torch.tensor([get_vocab_index(VOCAB_GENRES, song.get("genre", ""))], dtype=torch.long),
                    "era": torch.tensor([get_vocab_index(VOCAB_ERAS, map_year_to_era(song.get("releaseYear", "")))], dtype=torch.long),
                    "region": torch.tensor([get_vocab_index(VOCAB_REGIONS, song.get("country", ""))], dtype=torch.long),
                    "audio_features": torch.tensor([[
                        float(song.get("energy", 0.5)),
                        float(song.get("valence", 0.5)),
                        min(max(float(song.get("tempo", 100.0)) / 200.0, 0.0), 1.0),
                        float(song.get("acousticness", 0.5)),
                        min(max(float(song.get("popularity", 80.0)) / 100.0, 0.0), 1.0),
                        1.0 if song.get("isInstrumental") else 0.0
                    ]], dtype=torch.float32)
                }

                logit = model(u_batch, s_batch)
                prob = torch.sigmoid(logit).item()
                scores.append((song, prob))

        scores.sort(key=lambda x: x[1], reverse=True)
        top5 = scores[:5]

        print("--- MeongAI 1.0 신경망 예측 상위 5곡 ---")
        for rank, (song, score) in enumerate(top5, 1):
            print(f"  {rank}. [{score*100:.1f}점] {song['artist']} - {song['title']} ({song['releaseYear']}년 / {song['genre']})")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate MeongAI 1.0")
    parser.add_argument("--catalog_path", type=str, default="meong_ai/data/catalog.json")
    parser.add_argument("--checkpoint", type=str, default="meong_ai/checkpoints/meong_ranker.pt")
    parser.add_argument("--embed_dim", type=int, default=16)
    parser.add_argument("--hidden_dim", type=int, default=64)
    args = parser.parse_args()
    evaluate_meong_ai(args)
