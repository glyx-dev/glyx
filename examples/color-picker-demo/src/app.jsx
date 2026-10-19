// A colour picker: drag in the square and on the strips, type a hex, pick a preset. The second one has an opacity strip, and the third
// sits in a form field. The swatch under each shows the colour as it is chosen.
import React from 'react';
import { View, Text, ColorPicker, render } from '@glyx-dev/react';
import { useForm, FormField } from '@glyx-dev/form';

function Swatch({ color }) {
  return <View width={120} height={40} style={{ borderRadius: 8, backgroundColor: color, borderWidth: 1, borderColor: '#3c4464' }} />;
}

function App() {
  const [plain, setPlain] = React.useState('#7aa2f7');
  const [alpha, setAlpha] = React.useState('#f38ba8cc');
  const form = useForm({ defaultValues: { brand: '#a6e3a1' }, onSubmit: () => {} });
  return (
    <View style={{ flex: 1, backgroundColor: '#12121a', padding: 24, gap: 18 }}>
      <Text fontSize={20} style={{ color: '#e0e0f0' }}>Colour picker</Text>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <ColorPicker value={plain} onValueChange={setPlain} />
        <Swatch color={plain} />
      </View>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <ColorPicker value={alpha} onValueChange={setAlpha} alpha presets />
        <Swatch color={alpha} />
      </View>
      <FormField form={form} name="brand" label="Brand colour">
        <ColorPicker value={form.values.brand} onValueChange={(c) => form.setValue('brand', c)} presets={['#a6e3a1', '#89b4fa', '#cba6f7', '#f9e2af']} />
      </FormField>
      <Text fontSize={13} style={{ color: '#9aa0b6' }}>{`plain ${plain}   alpha ${alpha}   brand ${form.values.brand}`}</Text>
    </View>
  );
}

render(<App />);
