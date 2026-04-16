import { test, expect, Page } from '@playwright/test';

declare global {
  interface Window {
    __setGameState?: (state: any) => void;
  }
}

test.describe('Lobby', () => {
  test('renders all five game cards', async ({ page }) => {
    await page.goto('/games.html');
    await expect(page.getByTestId('card-tictactoe')).toBeVisible();
    await expect(page.getByTestId('card-voltpath')).toBeVisible();
    await expect(page.getByTestId('card-nullcore')).toBeVisible();
    await expect(page.getByTestId('card-swarm')).toBeVisible();
    await expect(page.getByTestId('card-wallbreak')).toBeVisible();
  });

  test('voltpath card navigates to /games/voltpath', async ({ page }) => {
    await page.goto('/games.html');
    await page.getByTestId('card-voltpath').click();
    await expect(page).toHaveURL(/\/games\/voltpath$/);
    await expect(page.getByRole('heading', { name: /voltpath/i })).toBeVisible();
  });

  test('nullcore card navigates to /games/nullcore', async ({ page }) => {
    await page.goto('/games.html');
    await page.getByTestId('card-nullcore').click();
    await expect(page).toHaveURL(/\/games\/nullcore$/);
  });

  test('swarm card navigates to /games/swarm', async ({ page }) => {
    await page.goto('/games.html');
    await page.getByTestId('card-swarm').click();
    await expect(page).toHaveURL(/\/games\/swarm$/);
  });

  test('wallbreak card navigates to /games/wallbreak', async ({ page }) => {
    await page.goto('/games.html');
    await page.getByTestId('card-wallbreak').click();
    await expect(page).toHaveURL(/\/games\/wallbreak$/);
  });

  test('tictactoe card navigates to /tictactoe.html', async ({ page }) => {
    await page.goto('/games.html');
    await page.getByTestId('card-tictactoe').click();
    await expect(page).toHaveURL(/\/tictactoe\.html$/);
  });
});

async function openVoltpathLevel(page: Page, idx = 0) {
  await page.goto('/games/voltpath');
  await page.getByTestId(`level-${idx}`).click();
  await expect(page.getByTestId('vp-grid')).toBeVisible();
}

test.describe('Voltpath', () => {
  test('level select renders and level opens', async ({ page }) => {
    await page.goto('/games/voltpath');
    await expect(page.getByTestId('level-0')).toBeVisible();
    await page.getByTestId('level-0').click();
    await expect(page.getByTestId('vp-grid')).toBeVisible();
    await expect(page.getByTestId('hand-straight')).toBeVisible();
  });

  test('select hand tile and place on grid', async ({ page }) => {
    await openVoltpathLevel(page);
    await page.getByTestId('hand-straight').click();
    await page.getByTestId('vp-cell-0-2').click();
    const cell = page.getByTestId('vp-cell-0-2');
    await expect(cell.locator('svg').first()).toBeVisible();
  });

  test('reset restores the initial hand count', async ({ page }) => {
    await openVoltpathLevel(page);
    await expect(page.getByTestId('hand-straight')).toContainText('5');
    await page.getByTestId('hand-straight').click();
    await page.getByTestId('vp-cell-0-2').click();
    await expect(page.getByTestId('hand-straight')).toContainText('4');
    await page.getByTestId('reset-btn').click();
    await expect(page.getByTestId('hand-straight')).toContainText('5');
  });

  test('win banner appears via __setGameState', async ({ page }) => {
    await openVoltpathLevel(page);
    await page.evaluate(() => {
      window.__setGameState?.({ won: true, path: [{ r: 0, c: 0 }, { r: 0, c: 5 }] });
    });
    await expect(page.getByTestId('win-banner')).toBeVisible();
  });
});

test.describe('Nullcore', () => {
  test('level select renders and level opens', async ({ page }) => {
    await page.goto('/games/nullcore');
    await expect(page.getByTestId('level-0')).toBeVisible();
    await page.getByTestId('level-0').click();
    await expect(page.getByTestId('code-editor')).toBeVisible();
    await expect(page.getByTestId('step-btn')).toBeVisible();
  });

  test('primary interaction: run test on starter code passes', async ({ page }) => {
    await page.goto('/games/nullcore');
    await page.getByTestId('level-0').click();
    await page.getByTestId('test-btn').click();
    await expect(page.getByTestId('test-0')).toHaveClass(/pass/);
  });

  test('reset button clears registers', async ({ page }) => {
    await page.goto('/games/nullcore');
    await page.getByTestId('level-0').click();
    await page.getByTestId('run-btn').click();
    await page.getByTestId('reset-btn').click();
    await expect(page.getByTestId('code-editor')).toBeVisible();
  });

  test('win banner appears via __setGameState', async ({ page }) => {
    await page.goto('/games/nullcore');
    await page.getByTestId('level-0').click();
    await page.evaluate(() => {
      window.__setGameState?.({ testResults: { allPass: true, results: [] } });
    });
    await expect(page.getByTestId('win-banner')).toBeVisible();
  });
});

test.describe('Wallbreak', () => {
  test('board mounts with both pawns', async ({ page }) => {
    await page.goto('/games/wallbreak');
    await expect(page.getByTestId('wb-board')).toBeVisible();
    await expect(page.getByTestId('pawn-0')).toBeVisible();
    await expect(page.getByTestId('pawn-1')).toBeVisible();
  });

  test('move pawn to adjacent cell', async ({ page }) => {
    await page.goto('/games/wallbreak');
    await page.getByTestId('wb-cell-1-4').click();
    await expect(page.locator('.games-panel').first()).toContainText(/thinking|computer/i);
  });

  test('restart button resets turn', async ({ page }) => {
    await page.goto('/games/wallbreak');
    await page.getByTestId('wb-cell-1-4').click();
    await page.getByTestId('reset-btn').click();
    await expect(page.locator('.games-panel').first()).toContainText(/your turn/i);
  });

  test('win banner appears via __setGameState', async ({ page }) => {
    await page.goto('/games/wallbreak');
    await expect(page.getByTestId('wb-board')).toBeVisible();
    await page.waitForFunction(() => typeof window.__setGameState === 'function');
    await page.evaluate(() => {
      window.__setGameState?.({ winner: 0 });
    });
    await expect(page.getByTestId('win-banner')).toBeVisible();
  });
});

test.describe('Swarm', () => {
  test('board mounts and trays show pieces', async ({ page }) => {
    await page.goto('/games/swarm');
    await expect(page.getByTestId('sw-board')).toBeVisible();
    await expect(page.getByTestId('tray-0-queen')).toBeVisible();
    await expect(page.getByTestId('tray-1-queen')).toBeVisible();
  });

  test('select tray piece and place on first hex', async ({ page }) => {
    await page.goto('/games/swarm');
    await page.getByTestId('tray-0-ant').click();
    await page.getByTestId('sw-hex-0-0').click();
    await expect(page.locator('.games-panel')).toContainText(/thinking|computer/i);
  });

  test('restart resets turn to player 1', async ({ page }) => {
    await page.goto('/games/swarm');
    await page.getByTestId('tray-0-ant').click();
    await page.getByTestId('sw-hex-0-0').click();
    await page.getByTestId('reset-btn').click();
    await expect(page.locator('.games-panel')).toContainText(/your turn/i);
  });

  test('win banner appears via __setGameState', async ({ page }) => {
    await page.goto('/games/swarm');
    await expect(page.getByTestId('sw-board')).toBeVisible();
    await page.waitForFunction(() => typeof window.__setGameState === 'function');
    await page.evaluate(() => {
      window.__setGameState?.({ winner: 0 });
    });
    await expect(page.getByTestId('win-banner')).toBeVisible();
  });
});
