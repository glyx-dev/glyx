# Menu bar demo

A native File / Edit / View menu bar built with `menubar.set`. It shows menus with mnemonics (`&File`), accelerators, separators, a submenu, checkable items that report their new state, and an item that is enabled and disabled at runtime (Undo).

The last few choices are listed in the window, so you can see what `menubar.onSelect` reports for a mouse click, an Alt-key choice and an accelerator.

Native menu bars work on Windows for now. Elsewhere the demo shows the error `menubar.set` throws.

**Mode:** JS-only dev (runs on the prebuilt `glyx-runner`, no Rust compile of your own).

## Run it

```bash
cd examples/menubar-demo
glyx dev
```
