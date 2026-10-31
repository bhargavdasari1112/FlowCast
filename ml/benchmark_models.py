"""
FlowCast AI - Audited & Calibrated Machine Learning Estimators (V2.1)
Implements Class-Weighted Softmax, Gradient Boosting, Random Forest, Ridge,
Brier score calibration, PR-AUC, and full tree serialization.
"""

import numpy as np
from scipy.optimize import minimize
from typing import Dict, Any, List, Optional, Tuple

class DecisionNode:
    def __init__(self, feature_idx=None, threshold=None, left=None, right=None, value=None):
        self.feature_idx = feature_idx
        self.threshold = threshold
        self.left = left
        self.right = right
        self.value = value

    @property
    def is_leaf(self):
        return self.value is not None

    def to_dict(self):
        if self.is_leaf:
            return {"value": float(self.value)}
        return {
            "feature_idx": int(self.feature_idx),
            "threshold": float(self.threshold),
            "left": self.left.to_dict() if self.left else None,
            "right": self.right.to_dict() if self.right else None
        }

    @classmethod
    def from_dict(cls, d):
        if not d: return None
        if "value" in d:
            return cls(value=d["value"])
        return cls(
            feature_idx=d["feature_idx"],
            threshold=d["threshold"],
            left=cls.from_dict(d.get("left")),
            right=cls.from_dict(d.get("right"))
        )

class DecisionTreeRegressorFast:
    def __init__(self, max_depth=5, min_samples_split=8, max_features=None):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features = max_features
        self.root: Optional[DecisionNode] = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        self.root = self._build_tree(X, y, depth=0)
        return self

    def _build_tree(self, X: np.ndarray, y: np.ndarray, depth: int) -> DecisionNode:
        n_samples, n_features = X.shape
        if depth >= self.max_depth or n_samples < self.min_samples_split or np.var(y) < 1e-7:
            return DecisionNode(value=float(np.mean(y)))

        feat_indices = np.arange(n_features)
        if self.max_features and self.max_features < n_features:
            feat_indices = np.random.choice(n_features, self.max_features, replace=False)

        best_feat, best_thresh, best_score = None, None, float("inf")
        sub_idx = np.random.choice(n_samples, min(1200, n_samples), replace=False) if n_samples > 1200 else np.arange(n_samples)
        X_sub = X[sub_idx]
        y_sub = y[sub_idx]

        for feat in feat_indices:
            vals = X_sub[:, feat]
            thresholds = np.percentile(vals, [20, 35, 50, 65, 80])
            for thresh in thresholds:
                left_mask = vals <= thresh
                right_mask = ~left_mask
                if np.sum(left_mask) < 4 or np.sum(right_mask) < 4:
                    continue
                left_y, right_y = y_sub[left_mask], y_sub[right_mask]
                impurity = np.var(left_y) * len(left_y) + np.var(right_y) * len(right_y)
                if impurity < best_score:
                    best_score = impurity
                    best_feat = feat
                    best_thresh = thresh

        if best_feat is None:
            return DecisionNode(value=float(np.mean(y)))

        left_mask = X[:, best_feat] <= best_thresh
        left_child = self._build_tree(X[left_mask], y[left_mask], depth + 1)
        right_child = self._build_tree(X[~left_mask], y[~left_mask], depth + 1)
        return DecisionNode(feature_idx=best_feat, threshold=best_thresh, left=left_child, right=right_child)

    def predict_single(self, node: DecisionNode, x: np.ndarray) -> float:
        if node.is_leaf:
            return node.value
        if x[node.feature_idx] <= node.threshold:
            return self.predict_single(node.left, x)
        return self.predict_single(node.right, x)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.array([self.predict_single(self.root, x) for x in X])

    def to_dict(self):
        return {"max_depth": self.max_depth, "root": self.root.to_dict() if self.root else None}

    def from_dict(self, d):
        self.max_depth = d.get("max_depth", 5)
        self.root = DecisionNode.from_dict(d.get("root"))


class GradientBoostingModel:
    """Sequential stage-wise Gradient Boosted Decision Trees with learning rate shrinkage"""
    def __init__(self, n_estimators=20, learning_rate=0.12, max_depth=4):
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.max_depth = max_depth
        self.base_pred = 0.0
        self.trees: List[DecisionTreeRegressorFast] = []

    def fit(self, X: np.ndarray, y: np.ndarray):
        self.base_pred = float(np.mean(y))
        current_pred = np.full(len(y), self.base_pred)
        self.trees = []

        for _ in range(self.n_estimators):
            residuals = y - current_pred
            tree = DecisionTreeRegressorFast(max_depth=self.max_depth, min_samples_split=8)
            tree.fit(X, residuals)
            update = tree.predict(X)
            current_pred += self.learning_rate * update
            self.trees.append(tree)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        preds = np.full(len(X), self.base_pred)
        for tree in self.trees:
            preds += self.learning_rate * tree.predict(X)
        return preds

    def to_dict(self):
        return {
            "n_estimators": self.n_estimators,
            "learning_rate": self.learning_rate,
            "max_depth": self.max_depth,
            "base_pred": self.base_pred,
            "trees": [t.to_dict() for t in self.trees]
        }

    def from_dict(self, d):
        self.n_estimators = d["n_estimators"]
        self.learning_rate = d["learning_rate"]
        self.max_depth = d["max_depth"]
        self.base_pred = d["base_pred"]
        self.trees = []
        for td in d.get("trees", []):
            t = DecisionTreeRegressorFast()
            t.from_dict(td)
            self.trees.append(t)


class RandomForestModel:
    """Random Forest Regressor with Bootstrap Aggregation"""
    def __init__(self, n_estimators=15, max_depth=5, min_samples_split=8, max_features="sqrt"):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features_strategy = max_features
        self.trees: List[DecisionTreeRegressorFast] = []

    def fit(self, X: np.ndarray, y: np.ndarray):
        self.trees = []
        N, D = X.shape
        max_feat = int(np.sqrt(D)) if self.max_features_strategy == "sqrt" else D
        for _ in range(self.n_estimators):
            boot_idx = np.random.choice(N, N, replace=True)
            tree = DecisionTreeRegressorFast(max_depth=self.max_depth, min_samples_split=self.min_samples_split, max_features=max_feat)
            tree.fit(X[boot_idx], y[boot_idx])
            self.trees.append(tree)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        all_preds = np.column_stack([tree.predict(X) for tree in self.trees])
        return np.mean(all_preds, axis=1)

    def to_dict(self):
        return {
            "n_estimators": self.n_estimators,
            "trees": [t.to_dict() for t in self.trees]
        }


class AutoRegressiveModel:
    """Time-Series Lagged Auto-Regressive model (AR-Lag + Moving Average)"""
    def __init__(self):
        self.weights = None
        self.intercept = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray):
        N = len(X)
        X_lag = X[:, -6:]
        X_b = np.column_stack([np.ones(N), X_lag])
        reg = np.eye(X_b.shape[1]) * 1.0
        reg[0, 0] = 0.0
        w = np.linalg.solve(np.dot(X_b.T, X_b) + reg, np.dot(X_b.T, y))
        self.intercept = float(w[0])
        self.weights = w[1:]
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_lag = X[:, -6:]
        return np.dot(X_lag, self.weights) + self.intercept

    def to_dict(self):
        return {"intercept": self.intercept, "weights": self.weights.tolist() if self.weights is not None else []}

    def from_dict(self, d):
        self.intercept = float(d["intercept"])
        self.weights = np.array(d["weights"])


class RidgeModel:
    def __init__(self, alpha=1.0):
        self.alpha = float(alpha)
        self.weights = None
        self.intercept = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray):
        N, D = X.shape
        X_b = np.column_stack([np.ones(N), X])
        reg = np.eye(D + 1) * self.alpha
        reg[0, 0] = 0.0
        w = np.linalg.solve(np.dot(X_b.T, X_b) + reg, np.dot(X_b.T, y))
        self.intercept = float(w[0])
        self.weights = w[1:]
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.dot(X, self.weights) + self.intercept

    def to_dict(self):
        return {"alpha": self.alpha, "intercept": self.intercept, "weights": self.weights.tolist() if self.weights is not None else []}

    def from_dict(self, d):
        self.alpha = float(d.get("alpha", 1.0))
        self.intercept = float(d["intercept"])
        self.weights = np.array(d["weights"])


class ClassWeightedSoftmaxClassifier:
    """
    Multinomial Logistic Regression with Class-Weighted Cross-Entropy Loss.
    Solves extreme class imbalance for minority congestion & accident risk classes!
    """
    def __init__(self, alpha=0.5, max_iter=200, class_weight="balanced"):
        self.alpha = float(alpha)
        self.max_iter = max_iter
        self.class_weight = class_weight
        self.classes: List[str] = []
        self.weights: Optional[np.ndarray] = None
        self.weights_k: Optional[np.ndarray] = None # Class weights vector

    def _softmax(self, Z: np.ndarray) -> np.ndarray:
        exp_Z = np.exp(Z - np.max(Z, axis=1, keepdims=True))
        return exp_Z / np.sum(exp_Z, axis=1, keepdims=True)

    def fit(self, X: np.ndarray, y: np.ndarray, class_names: Optional[List[str]] = None):
        self.classes = list(class_names) if class_names else list(np.unique(y))
        N, D = X.shape
        K = len(self.classes)
        
        Y = np.zeros((N, K))
        counts = np.zeros(K)
        for k, cls in enumerate(self.classes):
            mask = (y == cls)
            Y[mask, k] = 1.0
            counts[k] = np.sum(mask)

        # Compute balanced class weights w_k = N / (K * count_k)
        if self.class_weight == "balanced":
            self.weights_k = N / (K * np.maximum(counts, 1.0))
            self.weights_k = np.power(self.weights_k, 0.75) # Temper high exponent to preserve stability
            self.weights_k /= np.mean(self.weights_k)
        else:
            self.weights_k = np.ones(K)

        X_b = np.column_stack([np.ones(N), X])
        W_sample = np.dot(Y, self.weights_k).reshape(-1, 1) # shape (N, 1)

        def loss_and_grad(w_flat):
            W = w_flat.reshape((D + 1, K))
            Z = np.dot(X_b, W)
            P = self._softmax(Z)
            eps = 1e-12

            # Weighted Cross Entropy: - (1/N) * sum_i w_i * log(P_{i, y_i})
            weighted_log_p = np.sum(Y * np.log(P + eps), axis=1, keepdims=True) * W_sample
            loss = -float(np.mean(weighted_log_p)) + (0.5 * self.alpha / N) * np.sum(W[1:] ** 2)

            # Weighted Gradient: (1/N) * X_b^T (W_sample * (P - Y))
            diff = W_sample * (P - Y)
            grad = np.dot(X_b.T, diff) / N
            grad[1:] += (self.alpha / N) * W[1:]
            return loss, grad.flatten()

        w0 = np.zeros((D + 1) * K)
        res = minimize(loss_and_grad, w0, method="L-BFGS-B", jac=True, options={"maxiter": self.max_iter})
        self.weights = res.x.reshape((D + 1, K))
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        N = X.shape[0]
        X_b = np.column_stack([np.ones(N), X])
        return self._softmax(np.dot(X_b, self.weights))

    def predict(self, X: np.ndarray) -> np.ndarray:
        probs = self.predict_proba(X)
        return np.array([self.classes[i] for i in np.argmax(probs, axis=1)])

    def to_dict(self):
        return {
            "classes": self.classes,
            "weights": self.weights.tolist() if self.weights is not None else [],
            "weights_k": self.weights_k.tolist() if self.weights_k is not None else []
        }

    def from_dict(self, d):
        self.classes = d["classes"]
        self.weights = np.array(d["weights"])
        if "weights_k" in d:
            self.weights_k = np.array(d["weights_k"])


# Audited Evaluation Metrics Suite
def evaluate_regression(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    errors = y_true - y_pred
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    ss_res = np.sum(errors ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = float(1.0 - (ss_res / (ss_tot + 1e-9)))
    non_zero = np.abs(y_true) > 1e-3
    mape = float(np.mean(np.abs(errors[non_zero] / y_true[non_zero])) * 100.0) if np.any(non_zero) else 0.0
    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "r2": round(r2, 4),
        "mape": round(mape, 2)
    }

def evaluate_classification(y_true: np.ndarray, y_pred: np.ndarray, y_probs: np.ndarray, classes: List[str]) -> Dict[str, Any]:
    N = len(y_true)
    K = len(classes)
    acc = float(np.mean(y_true == y_pred))
    
    cm = np.zeros((K, K), dtype=int)
    class_to_idx = {c: i for i, c in enumerate(classes)}
    for t, p in zip(y_true, y_pred):
        cm[class_to_idx[t], class_to_idx[p]] += 1

    precisions, recalls, f1s, supports = [], [], [], []
    per_class_metrics = {}
    class_distribution = {}

    for i, cls in enumerate(classes):
        tp = cm[i, i]
        fp = np.sum(cm[:, i]) - tp
        fn = np.sum(cm[i, :]) - tp
        support = int(np.sum(cm[i, :]))
        p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
        precisions.append(p)
        recalls.append(r)
        f1s.append(f)
        supports.append(support)
        per_class_metrics[cls] = {
            "precision": round(float(p), 3),
            "recall": round(float(r), 3),
            "f1": round(float(f), 3),
            "support": support,
            "share_pct": round(float(support / max(1, N) * 100), 2)
        }
        class_distribution[cls] = support

    macro_p = float(np.mean(precisions))
    macro_r = float(np.mean(recalls))
    macro_f1 = float(np.mean(f1s))
    
    total_supp = sum(supports)
    weighted_f1 = float(sum(f * s for f, s in zip(f1s, supports)) / total_supp) if total_supp > 0 else 0.0

    # Multi-class ROC-AUC & PR-AUC
    roc_aucs, pr_aucs = [], []
    for k in range(K):
        binary_true = (y_true == classes[k]).astype(int)
        scores = y_probs[:, k]
        pos = np.sum(binary_true == 1)
        neg = np.sum(binary_true == 0)
        if pos > 0 and neg > 0:
            rank = np.argsort(scores)
            rank_sum = np.sum(np.where(binary_true[rank] == 1)[0] + 1)
            u = rank_sum - (pos * (pos + 1)) / 2.0
            roc_auc = float(u / (pos * neg))
            roc_aucs.append(roc_auc)
            sorted_idx = np.argsort(-scores)
            sorted_true = binary_true[sorted_idx]
            cum_pos = np.cumsum(sorted_true)
            prec_grid = cum_pos / (np.arange(len(sorted_true)) + 1)
            pr_auc = float(np.sum(prec_grid * sorted_true) / pos)
            pr_aucs.append(pr_auc)
        else:
            roc_aucs.append(0.5)
            pr_aucs.append(0.5)

    # Multi-class Brier Calibration Score: mean sum_k (P_ik - Y_ik)^2
    Y_onehot = np.zeros((N, K))
    for idx, t in enumerate(y_true):
        Y_onehot[idx, class_to_idx[t]] = 1.0
    brier_score = float(np.mean(np.sum((y_probs - Y_onehot) ** 2, axis=1)))

    # Reliability diagram decile bins for top class
    max_probs = np.max(y_probs, axis=1)
    correct_preds = (y_true == y_pred).astype(int)
    bin_edges = np.linspace(0.0, 1.0, 6)
    reliability_bins = []
    for b_idx in range(len(bin_edges) - 1):
        low, high = bin_edges[b_idx], bin_edges[b_idx + 1]
        mask = (max_probs >= low) & (max_probs < high)
        if np.sum(mask) > 0:
            conf = float(np.mean(max_probs[mask]))
            acc_bin = float(np.mean(correct_preds[mask]))
            reliability_bins.append({
                "bin_range": f"{int(low*100)}-{int(high*100)}%",
                "avg_confidence": round(conf, 3),
                "empirical_accuracy": round(acc_bin, 3),
                "samples": int(np.sum(mask))
            })

    return {
        "accuracy": round(acc, 4),
        "macro_precision": round(macro_p, 4),
        "macro_recall": round(macro_r, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "roc_auc": round(float(np.mean(roc_aucs)), 4),
        "pr_auc": round(float(np.mean(pr_aucs)), 4),
        "brier_score": round(brier_score, 4),
        "classes": classes,
        "class_distribution": class_distribution,
        "per_class": per_class_metrics,
        "confusion_matrix": cm.tolist(),
        "reliability_bins": reliability_bins
    }
