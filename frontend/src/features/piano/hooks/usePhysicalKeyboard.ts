import { useEffect, useRef } from "react";
import {
  KeyboardController,
  type KeyboardOptions,
} from "@/shared/utils/keyboardController";

/** Thin React binding: attaches window listeners once and always reads the latest options. */
export function usePhysicalKeyboard(opts: KeyboardOptions) {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    const controller = new KeyboardController(() => ref.current);
    const onKeyDown = (e: KeyboardEvent) => controller.keyDown(e);
    const onKeyUp = (e: KeyboardEvent) => controller.keyUp(e);
    const onBlur = () => controller.releaseAll();
    const onVisibility = () => document.hidden && controller.releaseAll();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      controller.releaseAll();
    };
  }, []);
}
