"""
MeongAI 1.0 (멍플리 자체 음악 추천 신경망 모델)
Architecture: MeongRankerNet
- 사전 학습 모델(Pretrained Foundation Model)을 일체 사용하지 않음
- 가중치를 처음부터(From Scratch) 학습하는 소형 심층 신경망 (PyTorch)
- 사용자 컨텍스트(기분, 상황, 선호 장르, 연대, 보컬 선호)와 곡 메타/오디오 특징(템포, 에너지, 밝기, 어쿠스틱)을
  결합하여 0.0 ~ 1.0 사이의 추천 적합도(Matching Score)를 예측함.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class MeongRankerNet(nn.Module):
    def __init__(
        self,
        num_moods: int = 10,
        num_situations: int = 10,
        num_genres: int = 15,
        num_eras: int = 8,
        num_regions: int = 8,
        num_vocals: int = 4,
        embed_dim: int = 16,
        audio_feature_dim: int = 6, # energy, valence, tempo_norm, acousticness, popularity_norm, is_instrumental
        hidden_dim: int = 64
    ):
        super(MeongRankerNet, self).__init__()

        # 1. User Context Embeddings
        self.mood_emb = nn.Embedding(num_moods, embed_dim)
        self.situation_emb = nn.Embedding(num_situations, embed_dim)
        self.user_genre_emb = nn.Embedding(num_genres, embed_dim)
        self.user_era_emb = nn.Embedding(num_eras, embed_dim // 2)
        self.user_region_emb = nn.Embedding(num_regions, embed_dim // 2)
        self.vocal_emb = nn.Embedding(num_vocals, embed_dim // 2)

        # User Context Dense Fusion
        user_input_dim = (embed_dim * 3) + (embed_dim // 2 * 3)  # 16*3 + 8*3 = 48 + 24 = 72
        self.user_fc = nn.Sequential(
            nn.Linear(user_input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, embed_dim * 2) # 32-dim user vector
        )

        # 2. Song Item Embeddings & Audio Features
        self.song_genre_emb = nn.Embedding(num_genres, embed_dim)
        self.song_era_emb = nn.Embedding(num_eras, embed_dim // 2)
        self.song_region_emb = nn.Embedding(num_regions, embed_dim // 2)
        
        song_cat_dim = embed_dim + (embed_dim // 2 * 2) # 16 + 16 = 32
        self.song_audio_fc = nn.Sequential(
            nn.Linear(audio_feature_dim, 16),
            nn.ReLU()
        )

        self.song_fc = nn.Sequential(
            nn.Linear(song_cat_dim + 16, hidden_dim), # 32 + 16 = 48 -> hidden_dim
            nn.ReLU(),
            nn.Linear(hidden_dim, embed_dim * 2) # 32-dim song vector
        )

        # 3. Neural Interaction & Ranking Head
        # Concat: [u, s, u*s, |u-s|] -> 32 * 4 = 128
        interaction_dim = (embed_dim * 2) * 4
        self.head = nn.Sequential(
            nn.Linear(interaction_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(p=0.15),
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )

        self._init_weights()

    def _init_weights(self):
        """Xavier & Uniform 가중치 초기화 (사전 학습 가중치 없음)"""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.Embedding):
                nn.init.normal_(m.weight, mean=0.0, std=0.05)

    def forward(self, user_batch, song_batch):
        """
        user_batch: dict of tensors {mood, situation, genre, era, region, vocal}
        song_batch: dict of tensors {genre, era, region, audio_features}
        returns: compatibility logits of shape (batch_size, 1)
        """
        # User Representation
        u_m = self.mood_emb(user_batch["mood"])
        u_s = self.situation_emb(user_batch["situation"])
        u_g = self.user_genre_emb(user_batch["genre"])
        u_e = self.user_era_emb(user_batch["era"])
        u_r = self.user_region_emb(user_batch["region"])
        u_v = self.vocal_emb(user_batch["vocal"])

        u_cat = torch.cat([u_m, u_s, u_g, u_e, u_r, u_v], dim=-1)
        user_vec = self.user_fc(u_cat) # (B, 32)

        # Song Representation
        s_g = self.song_genre_emb(song_batch["genre"])
        s_e = self.song_era_emb(song_batch["era"])
        s_r = self.song_region_emb(song_batch["region"])
        s_cat = torch.cat([s_g, s_e, s_r], dim=-1)
        s_audio = self.song_audio_fc(song_batch["audio_features"])
        song_combined = torch.cat([s_cat, s_audio], dim=-1)
        song_vec = self.song_fc(song_combined) # (B, 32)

        # Interaction Features
        diff = torch.abs(user_vec - song_vec)
        prod = user_vec * song_vec
        interaction = torch.cat([user_vec, song_vec, prod, diff], dim=-1) # (B, 128)

        logits = self.head(interaction)
        return logits.squeeze(-1)
