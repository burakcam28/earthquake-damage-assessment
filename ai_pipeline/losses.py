"""
Hybrid Loss Functions for Building Damage Segmentation
Combines Multi-Class Focal Loss and Soft Dice Loss to tackle severe class imbalance.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class FocalLoss(nn.Module):
    def __init__(self, alpha: float = 0.25, gamma: float = 2.0, reduction: str = "mean") -> None:
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        # inputs: (N, C, H, W) logits, targets: (N, H, W) class indices
        ce_loss = F.cross_entropy(inputs, targets, reduction="none")
        pt = torch.exp(-ce_loss)
        focal_loss = self.alpha * ((1 - pt) ** self.gamma) * ce_loss

        if self.reduction == "mean":
            return focal_loss.mean()
        elif self.reduction == "sum":
            return focal_loss.sum()
        return focal_loss


class MulticlassDiceLoss(nn.Module):
    def __init__(self, num_classes: int = 5, smooth: float = 1e-6) -> None:
        super().__init__()
        self.num_classes = num_classes
        self.smooth = smooth

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        # inputs: (N, C, H, W) logits, targets: (N, H, W) class indices
        probs = F.softmax(inputs, dim=1)
        targets_one_hot = F.one_hot(targets, num_classes=self.num_classes).permute(0, 3, 1, 2).float()

        dims = (0, 2, 3)
        intersection = torch.sum(probs * targets_one_hot, dims)
        cardinality = torch.sum(probs + targets_one_hot, dims)

        dice_score = (2.0 * intersection + self.smooth) / (cardinality + self.smooth)
        # Exclude or weight classes if needed (e.g. background class index 0)
        dice_loss = 1.0 - dice_score.mean()
        return dice_loss


class DamageAssessmentLoss(nn.Module):
    def __init__(
        self,
        num_classes: int = 5,
        focal_weight: float = 0.5,
        dice_weight: float = 0.5,
    ) -> None:
        super().__init__()
        self.focal = FocalLoss()
        self.dice = MulticlassDiceLoss(num_classes=num_classes)
        self.focal_weight = focal_weight
        self.dice_weight = dice_weight

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        loss_focal = self.focal(inputs, targets)
        loss_dice = self.dice(inputs, targets)
        return (self.focal_weight * loss_focal) + (self.dice_weight * loss_dice)
