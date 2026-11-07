# 🐾 MeongAI 1.0 (MeongRankerNet)

멍플리(Meong-Ply) 전용 **자체 딥러닝 음악 추천 신경망(In-House Neural Ranker)**입니다.
외부 생성형 AI(Gemini, Groq) 의존 없이, 비용 0원과 실존 음원 100% 보증을 목표로 설계된 소형 딥러닝 랭킹 모델입니다.

---

## 1. 모델 아키텍처 개요

- **모델명**: `MeongRankerNet`
- **학습 방식**: 사전 학습(Pretrained) 가중치를 일체 사용하지 않으며, Xavier Uniform으로 초기화하여 처음부터(From Scratch) 학습
- **입력 (Input)**:
  1. **사용자 컨텍스트 (User Context)**: 기분(Mood), 상황(Situation), 장르(Genre), 발매 연대(Era), 지역(Region), 보컬 선호(Vocal)
  2. **음악 트랙 피처 (Item Features)**: 장르, 연대, 국가, 연속형 오디오 피처(Energy, Valence, Tempo, Acousticness, Popularity, Instrumental)
- **임베딩 및 잠재 공간**:
  - 각각의 범주형 입력을 8~16차원 잠재 임베딩 벡터로 투영
  - 32차원 User Vector와 32차원 Song Vector 생성
- **상호작용 헤드 (Interaction Head)**:
  - `[User, Song, User * Song (Hadamard), |User - Song|]` 결합 (128차원)
  - Dense(128 → 64) → ReLU → Dropout(0.15) → Dense(64 → 32) → ReLU → Dense(32 → 1)
  - Sigmoid 활성화 함수를 통해 0.0 ~ 1.0 (0~100점) 범위의 적합도 점수 예측

---

## 2. 파일 구조

```
meong_ai/
├── data/
│   ├── catalog.json              # 50곡의 정밀 검증된 실존 음악 카탈로그
│   └── interactions.json         # 사용자 상황-곡 매칭 학습용 인터랙션 데이터
├── model.py                      # PyTorch MeongRankerNet 신경망 클래스
├── dataset.py                    # 데이터 무결성 검증기 & PyTorch Dataset
├── train.py                      # 손실함수(BCEWithLogitsLoss) 기반 학습 스크립트
├── evaluate.py                   # 랭킹 지표 평가 및 상위 5곡 추론 시연 스크립트
├── export_weights.py             # 학습된 가중치를 Node.js용 JSON으로 내보내는 스크립트
├── exported_model.json           # 내보내진 모델 파라미터 및 어휘 사전
└── requirements.txt              # PyTorch 로컬 설치 의존성 파일
```

---

## 3. 로컬 환경에서 학습(Train) 실행 방법

AI Studio 컨테이너에는 기본적으로 최소 리눅스 환경이 구성되어 있어 PyTorch GPU 학습용 바이너리가 미포함되어 있습니다.
따라서 로컬 컴퓨터(Mac, Windows, Linux) 또는 Google Colab에서 아래 단계를 통해 학습을 진행할 수 있습니다.

### Step 1: 가상환경 생성 및 의존성 설치
```bash
# 가상환경 생성
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# PyTorch 및 의존성 설치
pip install -r meong_ai/requirements.txt
```

### Step 2: 데이터셋 무결성 검증
```bash
python3 -c "from meong_ai.dataset import MusicCatalogValidator; cat = MusicCatalogValidator.validate_catalog('meong_ai/data/catalog.json'); MusicCatalogValidator.validate_interactions('meong_ai/data/interactions.json', cat)"
```

### Step 3: 모델 가중치 학습 (Training)
```bash
python3 meong_ai/train.py --epochs 30 --batch_size 8 --lr 0.003
```
- 학습이 완료되면 최저 검증 손실(Validation Loss)을 기록한 모델이 `meong_ai/checkpoints/meong_ranker.pt`에 저장됩니다.

### Step 4: 추천 랭킹 평가 (Evaluation)
```bash
python3 meong_ai/evaluate.py --checkpoint meong_ai/checkpoints/meong_ranker.pt
```

### Step 5: 웹앱 서빙용 가중치 내보내기 (Export)
```bash
python3 meong_ai/export_weights.py meong_ai/checkpoints/meong_ranker.pt meong_ai/exported_model.json
```
- 내보내진 `exported_model.json`은 Node.js + Express 웹앱에서 실시간 로드되어 0ms 속도로 추론에 사용됩니다.

---

## 4. 실존 음원 100% 보증 원칙 (Anti-Hallucination)

MeongAI 1.0은 텍스트를 임의로 조합하는 언어 모델이 아니며, **철저히 사전 검증된 실존 음악 카탈로그(`catalog.json`) 내의 모든 후보 곡에 대해 신경망 적합도 점수를 매긴 후 순위를 정렬하는 랭킹 모델**입니다.
따라서 존재하지 않는 가짜 곡이나 가공의 가수를 절대 생성해 내지 않습니다.
