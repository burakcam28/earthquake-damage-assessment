"""
Siamese U-Net Architecture for Post-Disaster Damage Assessment

Features:
- Dual-branch weight-sharing encoder (Pre & Post imagery)
- Difference + Concatenation feature fusion
- Multi-scale skip connections
- Outputs (Batch, NumClasses, Height, Width)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int) -> None:
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.conv(x)


class SiameseUNet(nn.Module):
    def __init__(self, in_channels: int = 3, num_classes: int = 5, base_channels: int = 64) -> None:
        super().__init__()
        self.num_classes = num_classes

        # Shared Encoder
        self.enc1 = ConvBlock(in_channels, base_channels)
        self.enc2 = ConvBlock(base_channels, base_channels * 2)
        self.enc3 = ConvBlock(base_channels * 2, base_channels * 4)
        self.enc4 = ConvBlock(base_channels * 4, base_channels * 8)

        self.pool = nn.MaxPool2d(2, 2)

        # Bottleneck (processes fused pre & post features)
        # We concatenate both features + absolute difference: (8 + 8 + 8) = 24 * base_channels
        self.bottleneck = ConvBlock(base_channels * 8 * 3, base_channels * 16)

        # Decoder with Skip Connections
        self.up4 = nn.ConvTranspose2d(base_channels * 16, base_channels * 8, kernel_size=2, stride=2)
        self.dec4 = ConvBlock(base_channels * 8 + (base_channels * 8 * 3), base_channels * 8)

        self.up3 = nn.ConvTranspose2d(base_channels * 8, base_channels * 4, kernel_size=2, stride=2)
        self.dec3 = ConvBlock(base_channels * 4 + (base_channels * 4 * 3), base_channels * 4)

        self.up2 = nn.ConvTranspose2d(base_channels * 4, base_channels * 2, kernel_size=2, stride=2)
        self.dec2 = ConvBlock(base_channels * 2 + (base_channels * 2 * 3), base_channels * 2)

        self.up1 = nn.ConvTranspose2d(base_channels * 2, base_channels, kernel_size=2, stride=2)
        self.dec1 = ConvBlock(base_channels + (base_channels * 3), base_channels)

        # Final Classifier
        self.classifier = nn.Conv2d(base_channels, num_classes, kernel_size=1)

    def _fuse(self, f_pre: torch.Tensor, f_post: torch.Tensor) -> torch.Tensor:
        diff = torch.abs(f_pre - f_post)
        return torch.cat([f_pre, f_post, diff], dim=1)

    def forward(self, pre_img: torch.Tensor, post_img: torch.Tensor) -> torch.Tensor:
        # Encoder passes (shared weights)
        e1_pre = self.enc1(pre_img)
        e1_post = self.enc1(post_img)
        f1 = self._fuse(e1_pre, e1_post)

        e2_pre = self.enc2(self.pool(e1_pre))
        e2_post = self.enc2(self.pool(e1_post))
        f2 = self._fuse(e2_pre, e2_post)

        e3_pre = self.enc3(self.pool(e2_pre))
        e3_post = self.enc3(self.pool(e2_post))
        f3 = self._fuse(e3_pre, e3_post)

        e4_pre = self.enc4(self.pool(e3_pre))
        e4_post = self.enc4(self.pool(e3_post))
        f4 = self._fuse(e4_pre, e4_post)

        # Bottleneck
        b = self.bottleneck(self.pool(f4))

        # Decoder
        d4 = self.up4(b)
        d4 = self.dec4(torch.cat([d4, f4], dim=1))

        d3 = self.up3(d4)
        d3 = self.dec3(torch.cat([d3, f3], dim=1))

        d2 = self.up2(d3)
        d2 = self.dec2(torch.cat([d2, f2], dim=1))

        d1 = self.up1(d2)
        d1 = self.dec1(torch.cat([d1, f1], dim=1))

        logits = self.classifier(d1)
        return logits
