using System;
using System.Drawing;
using System.Drawing.Text;
using System.Windows.Forms;

namespace CulturaDigital.SkinControls;

public class SkinButton : Button
{
	private State state = State.Normal;

	public int Value { get; set; }

	public SkinButton()
	{
		try
		{
			SetStyle(ControlStyles.DoubleBuffer, value: true);
			SetStyle(ControlStyles.AllPaintingInWmPaint, value: true);
			SetStyle(ControlStyles.UserPaint, value: true);
			SetStyle(ControlStyles.SupportsTransparentBackColor, value: true);
			SetStyle(ControlStyles.StandardDoubleClick, value: false);
			SetStyle(ControlStyles.Selectable, value: true);
			base.ResizeRedraw = true;
		}
		catch
		{
		}
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
		if (SkinImage.button.img == null)
		{
			base.OnPaint(e);
			return;
		}
		int index = (int)state;
		if (Focused && state != State.MouseDown)
		{
			index = 5;
		}
		if (!base.Enabled)
		{
			index = 4;
		}
		Rectangle clientRectangle = base.ClientRectangle;
		Graphics graphics = e.Graphics;
		InvokePaintBackground(this, new PaintEventArgs(e.Graphics, base.ClientRectangle));
		SkinDraw.DrawRect2(graphics, SkinImage.button, clientRectangle, index);
		Image image = null;
		Size alignThis = Size.Empty;
		Size empty = Size.Empty;
		if (base.Image != null)
		{
			image = base.Image;
		}
		else if (base.ImageList != null && base.ImageIndex != -1)
		{
			image = base.ImageList.Images[base.ImageIndex];
		}
		if (image != null)
		{
			empty.Width = image.Width;
			empty.Height = image.Height;
		}
		StringFormat stringFormat;
		using (stringFormat = new StringFormat())
		{
			stringFormat.HotkeyPrefix = HotkeyPrefix.Show;
			alignThis = Size.Ceiling(graphics.MeasureString(Text, Font, new SizeF(clientRectangle.Width, clientRectangle.Height), stringFormat));
		}
		clientRectangle.Inflate(-4, -4);
		if (empty.Width * empty.Height != 0)
		{
			Rectangle withinThis = clientRectangle;
			withinThis = SkinDraw.HAlignWithin(empty, withinThis, base.ImageAlign);
			withinThis = SkinDraw.VAlignWithin(empty, withinThis, base.ImageAlign);
			if (!base.Enabled)
			{
				ControlPaint.DrawImageDisabled(graphics, image, withinThis.Left, withinThis.Top, BackColor);
			}
			else
			{
				graphics.DrawImage(image, withinThis.Left, withinThis.Top, image.Width, image.Height);
			}
		}
		Rectangle withinThis2 = clientRectangle;
		withinThis2 = SkinDraw.HAlignWithin(alignThis, withinThis2, TextAlign);
		withinThis2 = SkinDraw.VAlignWithin(alignThis, withinThis2, TextAlign);
		stringFormat = new StringFormat();
		stringFormat.HotkeyPrefix = HotkeyPrefix.Show;
		if (RightToLeft == RightToLeft.Yes)
		{
			stringFormat.FormatFlags |= StringFormatFlags.DirectionRightToLeft;
		}
		Brush brush = new SolidBrush(ForeColor);
		graphics.DrawString(Text, Font, brush, withinThis2, stringFormat);
		brush.Dispose();
	}
}
