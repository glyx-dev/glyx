# Menu bar demo

A File / Edit / View menu bar, in two forms from one description:

- **The native bar** (`menubar.set`) on Windows and macOS, under the title bar or at the top of the screen.
- **The in-app bar** (`<MenuBar>`), drawn by Glyx, for Linux and for frameless windows. A button in the window switches between them, and on Linux the app starts with the in-app one.

It shows mnemonics (`&File`, then Alt+F), accelerators (Ctrl+N, Ctrl+G, Ctrl+1), separators, a submenu, checkable items that report their new state, and the ready-made editing items (`{ role: 'copy' }` and friends), which act on the text field in the window.

The last few choices are listed in the window, so you can see what `onSelect` reports for a mouse click, an Alt-key choice and an accelerator.

The macOS bar compiles and follows the menu library's documented use, but has not run on a Mac.

**Mode:** JS-only dev (runs on the prebuilt `glyx-runner`, no Rust compile of your own).

## Run it

```bash
cd examples/menubar-demo
glyx dev
```
