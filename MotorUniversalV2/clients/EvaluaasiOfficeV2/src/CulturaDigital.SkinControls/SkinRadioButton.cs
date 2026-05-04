using System;
using System.Drawing;
using System.Windows.Forms;

namespace CulturaDigital.SkinControls;

public class SkinRadioButton : RadioButton
{
	private State state = State.Normal;

	public int Value { get; set; }

	public SkinRadioButton()
	{
		SetStyle(ControlStyles.SupportsTransparentBackColor, value: true);
		BackColor = Color.Transparent;
	}

	protected override void OnMouseEnter(EventArgs e)
	{
		state = State.MouseOver;
		Invalidate();
		base.OnMouseEnter(e);
	}

	protected override void OnMouseLeave(EventArgs e)
	{
		state = State.Normal;
		Invalidate();
		base.OnMouseLeave(e);
	}

	protected override void OnMouseDown(MouseEventArgs e)
	{
		if ((e.Button & MouseButtons.Left) == MouseButtons.Left)
		{
			state = State.MouseDown;
			Invalidate();
			base.OnMouseDown(e);
		}
	}

	protected override void OnMouseUp(MouseEventArgs e)
	{
		if ((e.Button & MouseButtons.Left) == MouseButtons.Left)
		{
			state = State.Normal;
		}
		Invalidate();
		base.OnMouseUp(e);
	}

	protected override void OnPaint(PaintEventArgs e)
	{
		if (SkinImage.radiobutton.img == null)
		{
			base.OnPaint(e);
			return;
		}
		int num = (int)state;
		if (!base.Enabled)
		{
			num = 4;
		}
		if (base.Checked)
		{
			num += 4;
		}
		Rectangle clientRectangle = base.ClientRectangle;
		Graphics graphics = e.Graphics;
		base.OnPaint(e);
		int num2 = SystemInformation.MenuCheckSize.Width;
		SkinDraw.DrawRect1(r: (base.CheckAlign != ContentAlignment.MiddleLeft) ? Rectangle.FromLTRB(clientRectangle.Right - num2 - 1, (clientRectangle.Height - num2) / 2, clientRectangle.Right, (clientRectangle.Height + num2) / 2) : Rectangle.FromLTRB(0, (clientRectangle.Height - num2) / 2, num2, (clientRectangle.Height + num2) / 2), g: graphics, obj: SkinImage.radiobutton, index: num);
	}
}
