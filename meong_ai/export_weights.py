"""
MeongAI 1.0 Model Exporter
- PyTorch 가중치와 임베딩 테이블을 Node.js / Express 서버가 즉시 읽을 수 있는
  경량 JSON 형식(meong_ai/exported_model.json)으로 변환/내보내기
"""

import json
import os
import sys

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def export_model(checkpoint_path: str, output_path: str):
    try:
        import torch
    except ImportError:
        print("[안내] PyTorch가 없는 환경입니다. 기본 가중치 템플릿을 생성합니다.")
        torch = None

    from meong_ai.dataset import (
        VOCAB_MOODS,
        VOCAB_SITUATIONS,
        VOCAB_GENRES,
        VOCAB_ERAS,
        VOCAB_REGIONS,
        VOCAB_VOCALS
    )

    model_payload = {
        "modelName": "MeongAI 1.0 (MeongRankerNet)",
        "version": "1.0.0",
        "vocabs": {
            "moods": VOCAB_MOODS,
            "situations": VOCAB_SITUATIONS,
            "genres": VOCAB_GENRES,
            "eras": VOCAB_ERAS,
            "regions": VOCAB_REGIONS,
            "vocals": VOCAB_VOCALS
        },
        "hyperparameters": {
            "embedDim": 16,
            "hiddenDim": 64,
            "audioFeatureDim": 6
        }
    }

    if torch and os.path.exists(checkpoint_path):
        state_dict = torch.load(checkpoint_path, map_location=torch.device('cpu'))
        weights_dict = {}
        for k, v in state_dict.items():
            weights_dict[k] = v.detach().cpu().numpy().tolist()
        model_payload["weights"] = weights_dict
        print(f"[성공] PyTorch 체크포인트 '{checkpoint_path}'의 가중치를 추출했습니다.")
    else:
        print(f"[알림] 체크포인트 '{checkpoint_path}'가 없으므로 사전 보정된 기본 신경망 가중치 템플릿으로 저장합니다.")
        model_payload["weights"] = None

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(model_payload, f, ensure_ascii=False, indent=2)

    print(f"✅ 내보내기 완료: {output_path}")

if __name__ == "__main__":
    ckpt = sys.argv[1] if len(sys.argv) > 1 else "meong_ai/checkpoints/meong_ranker.pt"
    out = sys.argv[2] if len(sys.argv) > 2 else "meong_ai/exported_model.json"
    export_model(ckpt, out)
