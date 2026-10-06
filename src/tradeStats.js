export const WIN_LOSS_THRESHOLD = 30;

export const isWinningTrade = (pnl) => pnl > WIN_LOSS_THRESHOLD;
export const isLosingTrade  = (pnl) => pnl < -WIN_LOSS_THRESHOLD;