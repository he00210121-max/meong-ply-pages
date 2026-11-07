"""
MeongAI 1.0 (MeongRankerNet) Training Script
- 가중치를 처음부터(From Scratch) 학습하는 순수 PyTorch 신경망 학습 파이프라인
- 손실 함수: BCEWithLogitsLoss
- 최적화 알고리즘: AdamW + StepLR 학습률 스케줄러
"""

import argparse
import os
import sys

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def train_meong_ai(args):
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, random_split
    except ImportError:
        print("[안내] 현재 환경에 PyTorch(torch)가 설치되어 있지 않습니다.")
        print("로컬 컴퓨터 또는 GPU 환경에서 다음 명령어로 PyTorch를 설치 후 실행해 주세요:")
        print("  pip install -r meong_ai/requirements.txt")
        print("  python3 meong_ai/train.py --epochs 30")
        sys.exit(1)

    from meong_ai.model import MeongRankerNet
    from meong_ai.dataset import (
        MusicCatalogValidator,
        MeongRecommendationDataset,
        collate_fn,
        VOCAB_MOODS,
        VOCAB_SITUATIONS,
        VOCAB_GENRES,
        VOCAB_ERAS,
        VOCAB_REGIONS,
        VOCAB_VOCALS
    )

    print("==================================================")
    print("🐾 MeongAI 1.0 (MeongRankerNet) 학습 파이프라인 시작")
    print(f"Device: {'cuda' if torch.cuda.is_available() else 'cpu'}")
    print(f"Epochs: {args.epochs}, Batch Size: {args.batch_size}, LR: {args.lr}")
    print("==================================================")

    # 1. 데이터 검증 및 로드
    catalog = MusicCatalogValidator.validate_catalog(args.catalog_path)
    interactions = MusicCatalogValidator.validate_interactions(args.interactions_path, catalog)

    dataset = MeongRecommendationDataset(interactions, catalog)
    total_len = len(dataset)
    train_len = int(total_len * 0.8)
    val_len = total_len - train_len

    torch.manual_seed(42)
    train_dataset, val_dataset = random_split(dataset, [train_len, val_len])

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, collate_fn=collate_fn)

    # 2. 모델 인스턴스화 (사전 학습 모델 없음)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = MeongRankerNet(
        num_moods=len(VOCAB_MOODS),
        num_situations=len(VOCAB_SITUATIONS),
        num_genres=len(VOCAB_GENRES),
        num_eras=len(VOCAB_ERAS),
        num_regions=len(VOCAB_REGIONS),
        num_vocals=len(VOCAB_VOCALS),
        embed_dim=args.embed_dim,
        hidden_dim=args.hidden_dim
    ).to(device)

    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.7)

    best_val_loss = float("inf")
    save_dir = os.path.dirname(args.save_path)
    if save_dir:
        os.makedirs(save_dir, exist_ok=True)

    # 3. 학습 루프
    for epoch in range(1, args.epochs + 1):
        model.train()
        total_train_loss = 0.0

        for user_batch, song_batch, labels in train_loader:
            user_batch = {k: v.to(device) for k, v in user_batch.items()}
            song_batch = {k: v.to(device) for k, v in song_batch.items()}
            labels = labels.to(device)

            optimizer.zero_grad()
            logits = model(user_batch, song_batch)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()

            total_train_loss += loss.item() * len(labels)

        scheduler.step()
        avg_train_loss = total_train_loss / len(train_dataset)

        # 검증 루프
        model.eval()
        total_val_loss = 0.0
        correct_predictions = 0
        total_predictions = 0

        with torch.no_grad():
            for user_batch, song_batch, labels in val_loader:
                user_batch = {k: v.to(device) for k, v in user_batch.items()}
                song_batch = {k: v.to(device) for k, v in song_batch.items()}
                labels = labels.to(device)

                logits = model(user_batch, song_batch)
                loss = criterion(logits, labels)
                total_val_loss += loss.item() * len(labels)

                preds = (torch.sigmoid(logits) >= 0.5).float()
                correct_predictions += (preds == labels).sum().item()
                total_predictions += len(labels)

        avg_val_loss = total_val_loss / (len(val_dataset) if len(val_dataset) > 0 else 1)
        val_acc = (correct_predictions / total_predictions) * 100 if total_predictions > 0 else 0.0

        print(f"Epoch [{epoch:02d}/{args.epochs:02d}] Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f} | Val Acc: {val_acc:.1f}%")

        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            torch.save(model.state_dict(), args.save_path)

    print("==================================================")
    print(f"✅ MeongAI 1.0 학습 완료! 최고 검증 손실: {best_val_loss:.4f}")
    print(f"가중치 저장 완료: {args.save_path}")
    print("==================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train MeongAI 1.0 Neural Ranker")
    parser.add_argument("--catalog_path", type=str, default="meong_ai/data/catalog.json")
    parser.add_argument("--interactions_path", type=str, default="meong_ai/data/interactions.json")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=0.003)
    parser.add_argument("--embed_dim", type=int, default=16)
    parser.add_argument("--hidden_dim", type=int, default=64)
    parser.add_argument("--save_path", type=str, default="meong_ai/checkpoints/meong_ranker.pt")
    parsed_args = parser.parse_args()

    train_meong_ai(parsed_args)
