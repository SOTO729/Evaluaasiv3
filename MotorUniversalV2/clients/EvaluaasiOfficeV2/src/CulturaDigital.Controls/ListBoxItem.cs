namespace CulturaDigital.Controls;

public class ListBoxItem
{
	public int PreguntaId { get; set; }

	public int Orden { get; set; }

	public int Value { get; set; }

	public string Text { get; set; }

	public ListBoxItem()
	{
	}

	public ListBoxItem(int _Value, string _Text)
	{
		Value = _Value;
		Text = _Text;
	}

	public override string ToString()
	{
		return Text;
	}
}
