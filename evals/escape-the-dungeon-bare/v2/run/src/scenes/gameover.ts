import { makeButton, addCenteredText } from "../systems/ui";

export function gameoverScene(k: any) {
  addCenteredText(k, "YOU DIED", k.height() * 0.3, 48, [220, 50, 50]);
  addCenteredText(k, "You were revived at half strength.", k.height() * 0.45, 16, [200, 180, 180]);
  addCenteredText(k, "Some crystals were lost...", k.height() * 0.5, 14, [180, 160, 160]);

  makeButton(k, {
    label: "Continue",
    x: k.width() / 2,
    y: k.height() * 0.65,
    width: 200,
    height: 48,
    fontSize: 22,
    onClick: () => k.go("room"),
  });

  makeButton(k, {
    label: "Title Screen",
    x: k.width() / 2,
    y: k.height() * 0.78,
    width: 200,
    height: 44,
    onClick: () => k.go("title"),
  });
}
