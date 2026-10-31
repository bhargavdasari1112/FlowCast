"""
FlowCast AI - High-Performance Machine Learning Models
Native NumPy/SciPy estimators for Traffic Volume, Congestion, Travel Time, and Accident Risk.
"""

import numpy as np
from scipy.optimize import minimize

class RidgeRegression:
    def __init__(self, alpha=1.0):
        self.alpha = float(alpha)
        self.weights = None
        self.intercept = 0.0
        
    def fit(self, X, y):
        N, D = X.shape
        # Add intercept column
        X_b = np.column_stack([np.ones(N), X])
        
        # Regularization matrix (do not regularize bias)
        reg = np.eye(D + 1) * self.alpha
        reg[0, 0] = 0.0
        
        # Solve normal equations: (X_b^T X_b + reg)^-1 X_b^T y
        A = np.dot(X_b.T, X_b) + reg
        b = np.dot(X_b.T, y)
        w = np.linalg.solve(A, b)
        
        self.intercept = float(w[0])
        self.weights = w[1:]
        return self
        
    def predict(self, X):
        return np.dot(X, self.weights) + self.intercept
        
    def evaluate(self, X, y):
        y_pred = self.predict(X)
        errors = y - y_pred
        mae = float(np.mean(np.abs(errors)))
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        ss_res = np.sum(errors ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = float(1.0 - (ss_res / (ss_tot + 1e-9)))
        # Safe MAPE
        non_zero = np.abs(y) > 1e-3
        mape = float(np.mean(np.abs(errors[non_zero] / y[non_zero])) * 100.0) if np.any(non_zero) else 0.0
        
        return {
            "mae": round(mae, 3),
            "rmse": round(rmse, 3),
            "r2": round(r2, 4),
            "mape": round(mape, 2)
        }
        
    def get_feature_importance(self, feature_names):
        importances = np.abs(self.weights)
        total = np.sum(importances) + 1e-9
        relative = (importances / total) * 100.0
        
        ranking = []
        for name, weight, imp, rel in zip(feature_names, self.weights, importances, relative):
            ranking.append({
                "feature": name,
                "weight": round(float(weight), 4),
                "importance": round(float(imp), 4),
                "relative_pct": round(float(rel), 2)
            })
        ranking.sort(key=lambda x: x["importance"], reverse=True)
        return ranking

    def to_dict(self):
        return {
            "alpha": self.alpha,
            "intercept": self.intercept,
            "weights": self.weights.tolist() if self.weights is not None else []
        }
        
    def from_dict(self, d):
        self.alpha = float(d["alpha"])
        self.intercept = float(d["intercept"])
        self.weights = np.array(d["weights"])


class SoftmaxClassifier:
    """
    Multinomial Logistic Regression with L2 Regularization.
    """
    def __init__(self, alpha=0.5, max_iter=250):
        self.alpha = float(alpha)
        self.max_iter = max_iter
        self.classes = []
        self.weights = None # shape: (D + 1, K)
        
    def _softmax(self, Z):
        # Numerically stable softmax
        exp_Z = np.exp(Z - np.max(Z, axis=1, keepdims=True))
        return exp_Z / np.sum(exp_Z, axis=1, keepdims=True)
        
    def fit(self, X, y, class_names=None):
        if class_names is not None:
            self.classes = list(class_names)
        else:
            self.classes = list(np.unique(y))
            
        N, D = X.shape
        K = len(self.classes)
        
        # One-hot encode targets
        Y = np.zeros((N, K))
        for k, cls in enumerate(self.classes):
            Y[y == cls, k] = 1.0
            
        X_b = np.column_stack([np.ones(N), X]) # (N, D+1)
        
        # Loss and gradient for L-BFGS
        def loss_and_grad(w_flat):
            W = w_flat.reshape((D + 1, K))
            Z = np.dot(X_b, W)
            P = self._softmax(Z)
            
            # Cross entropy loss + L2 regularization (ignoring bias)
            eps = 1e-12
            loss = -np.mean(np.sum(Y * np.log(P + eps), axis=1))
            reg = 0.5 * self.alpha * np.sum(W[1:] ** 2) / N
            total_loss = loss + reg
            
            # Gradient
            grad = np.dot(X_b.T, (P - Y)) / N
            grad[1:] += (self.alpha / N) * W[1:]
            return total_loss, grad.flatten()
            
        # Initial guess
        w0 = np.zeros((D + 1) * K)
        res = minimize(
            loss_and_grad,
            w0,
            method="L-BFGS-B",
            jac=True,
            options={"maxiter": self.max_iter}
        )
        self.weights = res.x.reshape((D + 1, K))
        return self
        
    def predict_proba(self, X):
        N = X.shape[0]
        X_b = np.column_stack([np.ones(N), X])
        Z = np.dot(X_b, self.weights)
        return self._softmax(Z)
        
    def predict(self, X):
        probs = self.predict_proba(X)
        indices = np.argmax(probs, axis=1)
        return np.array([self.classes[i] for i in indices])
        
    def evaluate(self, X, y):
        preds = self.predict(X)
        N = len(y)
        acc = float(np.mean(preds == y))
        
        # Build Confusion Matrix
        K = len(self.classes)
        cm = np.zeros((K, K), dtype=int)
        class_to_idx = {cls: idx for idx, cls in enumerate(self.classes)}
        
        for true_val, pred_val in zip(y, preds):
            t_i = class_to_idx.get(true_val, -1)
            p_i = class_to_idx.get(pred_val, -1)
            if t_i >= 0 and p_i >= 0:
                cm[t_i, p_i] += 1
                
        # Precision, Recall, F1 per class
        precisions = []
        recalls = []
        f1s = []
        per_class = {}
        
        for i, cls in enumerate(self.classes):
            tp = cm[i, i]
            fp = np.sum(cm[:, i]) - tp
            fn = np.sum(cm[i, :]) - tp
            
            p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * (p * r) / (p + r) if (p + r) > 0 else 0.0
            
            precisions.append(p)
            recalls.append(r)
            f1s.append(f1)
            per_class[cls] = {
                "precision": round(float(p), 3),
                "recall": round(float(r), 3),
                "f1": round(float(f1), 3),
                "support": int(np.sum(cm[i, :]))
            }
            
        macro_p = float(np.mean(precisions))
        macro_r = float(np.mean(recalls))
        macro_f1 = float(np.mean(f1s))
        
        return {
            "accuracy": round(acc, 4),
            "macro_precision": round(macro_p, 4),
            "macro_recall": round(macro_r, 4),
            "macro_f1": round(macro_f1, 4),
            "classes": self.classes,
            "confusion_matrix": cm.tolist(),
            "per_class": per_class
        }

    def get_feature_importance(self, feature_names):
        # Weight magnitude averaged across classes
        importances = np.mean(np.abs(self.weights[1:]), axis=1)
        total = np.sum(importances) + 1e-9
        relative = (importances / total) * 100.0
        
        ranking = []
        for name, imp, rel in zip(feature_names, importances, relative):
            ranking.append({
                "feature": name,
                "importance": round(float(imp), 4),
                "relative_pct": round(float(rel), 2)
            })
        ranking.sort(key=lambda x: x["importance"], reverse=True)
        return ranking

    def to_dict(self):
        return {
            "alpha": self.alpha,
            "classes": self.classes,
            "weights": self.weights.tolist() if self.weights is not None else []
        }
        
    def from_dict(self, d):
        self.alpha = float(d["alpha"])
        self.classes = d["classes"]
        self.weights = np.array(d["weights"])
