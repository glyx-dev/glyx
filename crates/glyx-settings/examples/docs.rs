//! Prints the settings table for the documentation site, generated from the definitions so it cannot drift from the code:
//! `cargo run -p glyx-settings --example docs` (paste the output into `apis/settings.mdx` in the docs repo).

fn main() {
    print!("{}", glyx_settings::docs_markdown(glyx_settings::defs::DEFS));
}
