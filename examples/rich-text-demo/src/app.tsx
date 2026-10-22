import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, render, useWindowSize, glyxWindow } from '@glyx-dev/react';
import {
  RichTextEditor, RichTextToolbar, RichTextFeaturePicker, useEditorContext,
} from '@glyx-dev/rich-text';
import type { RichTextDocument } from '@glyx-dev/rich-text';

const FONT_FAMILIES = [
  'Segoe UI', 'Arial', 'Georgia', 'Times New Roman',
  'Cascadia Mono', 'Consolas', 'Courier New', 'serif', 'monospace',
];

const SAMPLE: RichTextDocument = {
  paragraphs: [
    {
      spans: [
        { text: 'Rich text, with real fonts.', fontSize: 26, bold: true, color: '#f0f0f8' },
      ],
    },
    {
      spans: [
        { text: 'Select a word, then use the Font and size menus. A format chosen with the caret between letters applies to the next text you type.', color: '#a8a8c0' },
      ],
    },
    {
      spans: [
        { text: 'Fonts: ', bold: true, color: '#7c8cff' },
        { text: 'Georgia', fontFamily: 'Georgia', fontSize: 22, color: '#f4c76b' },
        { text: '   Cascadia Mono', fontFamily: 'Cascadia Mono', fontSize: 18, color: '#6ee7b7' },
        { text: '   Arial', fontFamily: 'Arial', fontSize: 15, color: '#f0f0f8' },
      ],
    },
    {
      spans: [
        { text: 'Proportional: ', bold: true, color: '#7c8cff' },
        { text: '111111 222222 888888 1234567890', fontFamily: 'Georgia', fontSize: 20, color: '#e8e8f4' },
      ],
    },
    {
      spans: [
        { text: 'Tabular:      ', bold: true, color: '#7c8cff' },
        { text: '111111 222222 888888 1234567890', fontFamily: 'Georgia', fontSize: 20, fontFeatureSettings: "'tnum' 1", color: '#e8e8f4' },
      ],
    },
    {
      spans: [
        { text: 'Small caps: ', bold: true, color: '#7c8cff' },
        { text: 'The quick brown fox jumps over the lazy dog.', fontFamily: 'Georgia', fontSize: 18, fontFeatureSettings: "'smcp' 1", color: '#e8e8f4' },
      ],
    },
    {
      spans: [
        { text: 'Ligatures on: ', bold: true, color: '#7c8cff' },
        { text: 'office affluent fjord', fontFamily: 'Georgia', fontSize: 18, color: '#e8e8f4' },
        { text: '     off: ', bold: true, color: '#7c8cff' },
        { text: 'office affluent fjord', fontFamily: 'Georgia', fontSize: 18, fontFeatureSettings: "'liga' 0", color: '#e8e8f4' },
      ],
    },
    {
      spans: [
        { text: 'Bold', bold: true, color: '#e8e8f4' },
        { text: '  ', color: '#e8e8f4' },
        { text: 'Italic', italic: true, color: '#e8e8f4' },
        { text: '  ', color: '#e8e8f4' },
        { text: 'Underline', underline: true, color: '#e8e8f4' },
        { text: '  ', color: '#e8e8f4' },
        { text: 'Colour', color: '#fb7185' },
        { text: '  ', color: '#e8e8f4' },
        { text: 'Size 24', fontSize: 24, color: '#e8e8f4' },
      ],
    },
    {
      spans: [
        { text: 'Inline ', color: '#e8e8f4' },
        { text: 'code', code: true, color: '#e8e8f4' },
        { text: ', a ', color: '#e8e8f4' },
        { text: 'link', link: 'https://glyx.dev' },
        { text: ', and ', color: '#e8e8f4' },
        { text: 'a highlight', highlight: '#f6e05e66', color: '#e8e8f4' },
        { text: ', centered on the page.', color: '#e8e8f4' },
      ],
      align: 'center',
    },
    {
      spans: [{ text: 'A bullet list', color: '#e8e8f4' }],
      listType: 'bullet',
    },
    {
      spans: [{ text: 'Another item at the same level', color: '#e8e8f4' }],
      listType: 'bullet',
    },
    { spans: [{ text: '' }] },
  ],
};

export default function App() {
  const { width, height } = useWindowSize();
  const [doc, setDoc] = useState<RichTextDocument>(SAMPLE);
  const editorWidth = useMemo(() => Math.max(520, Math.min(720, width - 460)), [width]);
  const editorHeight = useMemo(() => Math.max(380, Math.min(570, height - 270)), [height]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0e0e15', padding: 24, flexDirection: 'row', gap: 22 }}>
      <View style={{ flex: 1, gap: 14 }}>
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#f0f0f8' }}>Rich text</Text>
          <Text style={{ fontSize: 13, color: '#8888a8' }}>
            Fonts, OpenType features, inline code, links, highlights and alignment.
          </Text>
        </View>

        <RichTextEditor
          value={doc}
          onChange={setDoc}
          width={editorWidth}
          height={editorHeight}
          fontSize={15}
          color="#e8e8f4"
          openLinks
          onLinkPress={(url) => glyxWindow.openExternal(url)}
          style={{ backgroundColor: '#151520' }}
        >
          <RichTextToolbar style={{ width: editorWidth }} fontFamilies={FONT_FAMILIES} />
          <RichTextFeaturePicker width={editorWidth} />
          <FormatStatus width={editorWidth} />
        </RichTextEditor>

        <Pressable
          onPress={() => setDoc(SAMPLE)}
          style={{
            alignSelf: 'flex-start', height: 32, paddingHorizontal: 14,
            alignItems: 'center', justifyContent: 'center', borderRadius: 7,
            borderWidth: 1, borderColor: '#2f2f44', backgroundColor: '#1a1a26',
          }}
        >
          <Text style={{ fontSize: 12, color: '#b8b8cc' }}>Reset sample</Text>
        </Pressable>
      </View>

      <View style={{ width: 340, gap: 12 }}>
        <SideCard title="What to test">
          <Step n="1" text="Click into the first paragraph and type. Then select words and press B, I or U." />
          <Step n="2" text="Select text and pick a family in the Font menu, then a size." />
          <Step n="3" text="Put the caret in the empty last paragraph, choose Georgia and 24, and type: the new text uses them." />
          <Step n="4" text="Select the sample lines and press Tabular figures, Small caps or No ligatures. The status line shows the features on the caret or selection." />
          <Step n="5" text="Select text and use the code, highlighter or link buttons in the toolbar. Ctrl+E also toggles inline code." />
          <Step n="6" text="Click the centered sample line and use the alignment menu. Click the sample link to edit its URL, remove it, or press Open to launch it in the system browser." />
          <Step n="7" text="Ctrl+C and Ctrl+V a formatted range to paste it with its formatting. Ctrl+Z undoes and Ctrl+Y (or Ctrl+Shift+Z) redoes." />
        </SideCard>

        <SideCard title="What to look for">
          <Text style={{ fontSize: 12, color: '#a8a8c0', lineHeight: 19 }}>
            The proportional and tabular number lines should line up differently.
            Small caps should draw lower-case letters as capitals, and ligatures
            should join “ff” when off is not selected. A font without a feature
            ignores it; the status line still records the run’s setting.
          </Text>
        </SideCard>

        <SideCard title="Selection and caret">
          <Text style={{ fontSize: 12, color: '#a8a8c0', lineHeight: 19 }}>
            Formatting a selection changes only those runs. Formatting with no
            selection sets the typing format for the next run and clears it when
            the caret moves.
          </Text>
        </SideCard>
      </View>
    </View>
  );
}

function FormatStatus({ width }: { width: number }) {
  const ctx = useEditorContext();
  if (!ctx) return null;
  const family = (ctx.formatValue('fontFamily') as string | undefined) ?? 'default';
  const size = ctx.formatValue('fontSize') ?? ctx.fontSize;
  const features = (ctx.formatValue('fontFeatureSettings') as string | undefined) ?? 'none';
  const where = ctx.sel.anchor.para === ctx.sel.focus.para && ctx.sel.anchor.offset === ctx.sel.focus.offset
    ? `caret ${ctx.cursor.para}:${ctx.cursor.offset}`
    : 'selection';

  return (
    <View style={{
      width, flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 9, paddingVertical: 6, marginBottom: 8,
      borderRadius: 5, backgroundColor: '#11111b', borderWidth: 1, borderColor: '#242436',
    }}>
      <Text style={{ fontSize: 11, color: '#707090' }}>{where}</Text>
      <Text style={{ fontSize: 11, color: '#a8a8c0' }}>Font: {family}</Text>
      <Text style={{ fontSize: 11, color: '#a8a8c0' }}>Size: {size}</Text>
      <Text style={{ fontSize: 11, color: '#a8a8c0' }}>Align: {ctx.align}</Text>
      <Text style={{ fontSize: 11, color: '#a8a8c0' }}>Features: {features}</Text>
    </View>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 7, padding: 14, borderRadius: 10, backgroundColor: '#151520', borderWidth: 1, borderColor: '#242436' }}>
      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#e8e8f4' }}>{title}</Text>
      {children}
    </View>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 7 }}>
      <Text style={{ width: 15, fontSize: 11, lineHeight: 18, color: '#7c8cff' }}>{n}</Text>
      <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: '#a8a8c0' }}>{text}</Text>
    </View>
  );
}

render(<App />);
