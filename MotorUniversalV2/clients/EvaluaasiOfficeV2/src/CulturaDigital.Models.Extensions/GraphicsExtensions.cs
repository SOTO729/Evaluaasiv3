using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Linq;

namespace CulturaDigital.Models.Extensions;

public static class GraphicsExtensions
{
	public static Graphics GenerarConstancia(this Graphics graphics, Usuario User, Voucher V, int calificacion, bool InLine, DateTime FechaFin, string NombreApp, List<Pregunta> Preguntas, List<Categoria> categorias, string cabecera, string IdTrans)
	{
		try
		{
			Font font = new Font("Arial", 58f);
			int num = 380;
			graphics.SmoothingMode = SmoothingMode.AntiAlias;
			graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
			graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
			graphics.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
			int length = NombreApp.Length;
			_ = 1275;
			_ = length / 2;
			StringFormat format = new StringFormat
			{
				Alignment = StringAlignment.Center,
				LineAlignment = StringAlignment.Center
			};
			graphics.DrawString(layoutRectangle: new RectangleF(200f, num, 2150f, 300f), s: NombreApp.ToUpper(), font: font, brush: Brushes.Black, format: format);
			num += 250;
			font = new Font("Arial", 35f);
			graphics.DrawString("Nombre : " + User.Nombre + " " + User.Apellido, font, Brushes.Black, 200f, num + 135);
			graphics.DrawString("Referencia : " + V.VoucherCode, font, Brushes.Black, 200f, num + 185);
			graphics.DrawString("Rol : " + User.Perfil, font, Brushes.Black, 200f, num + 235);
			graphics.DrawString(string.Format("Estatus : {0}", (calificacion >= 700) ? "APROBADO" : "NO APROBADO"), font, (calificacion >= 700) ? new SolidBrush(Color.FromArgb(19, 142, 183)) : Brushes.Red, 200f, num + 285);
			graphics.DrawString("Fecha   : " + FechaFin.ProcesarFecha(), font, Brushes.Black, 1600f, num + 135);
			graphics.DrawString(string.Format("IdTrans : {0}", InLine ? IdTrans : "Fuera de línea"), font, Brushes.Black, 1600f, num + 185);
			graphics.DrawString("Puntaje : " + calificacion + " de 1000", font, Brushes.Black, 1600f, num + 235);
			graphics.DrawString("EXAMEN", font, Brushes.Black, 1600f, num + 285);
			num += 120;
			font = new Font("Arial", 37f);
			graphics.DrawString("RESULTADOS POR CATEGORÍA", font, Brushes.Black, 910f, num + 380);
			font = new Font("Arial", 37f);
			graphics.DrawString("CATEGORÍAS", font, Brushes.Black, 350f, num + 510);
			graphics.DrawString("PORCENTAJE", font, Brushes.Black, 1800f, num + 510);
			num = 1300;
			foreach (Categoria categoria in categorias)
			{
				num += 50;
				font = new Font("Arial", 30f);
				graphics.DrawString(categoria.Nombre, font, Brushes.Black, 270f, num);
				num += 10;
				foreach (Tema t in categoria.Temas)
				{
					font = new Font("Arial", 20f);
					t.Preguntas = Preguntas.Where((Pregunta m) => m.TemaId == t.TemaId).ToList();
					int num2 = t.Preguntas.Count();
					int num3 = t.Preguntas.Where((Pregunta m) => m.Correcta == "true").Count();
					int num4 = 0;
					if (num2 > 0)
					{
						num4 = num3 * 100 / num2;
					}
					num += 30;
					graphics.DrawString(t.Nombre, font, Brushes.Black, 310f, num);
					if (num4 < 100)
					{
						graphics.DrawString(num4 + "%", font, Brushes.Black, 1910f, num);
					}
					else
					{
						graphics.DrawString(num4 + "%", font, Brushes.Black, 1900f, num);
					}
				}
			}
			Image image = cabecera.GenerarQR();
			graphics.DrawImage(image, 200, num + 100);
		}
		catch (Exception)
		{
		}
		return graphics;
	}

	private static bool DrawLetter(Graphics g, float emSize, string texto)
	{
		bool flag = false;
		try
		{
			float num = 2475f;
			float num2 = 2800f;
			Font font = new Font("Arial", emSize, FontStyle.Regular);
			font = FindBestFitFont(g, texto, font, new Size((int)num, (int)num2));
			SizeF sizeF = g.MeasureString(texto, font);
			g.DrawString(texto, font, new SolidBrush(Color.Black), (num - sizeF.Width) / 2f, 0f);
			return true;
		}
		catch (Exception)
		{
			return false;
		}
	}

	private static Font FindBestFitFont(Graphics g, string text, Font font, Size proposedSize)
	{
		while (true)
		{
			SizeF sizeF = g.MeasureString(text, font);
			if (sizeF.Height <= (float)proposedSize.Height && sizeF.Width <= (float)proposedSize.Width)
			{
				break;
			}
			Font font2 = font;
			font = new Font(font.Name, (float)((double)font.Size * 0.9), font.Style);
			font2.Dispose();
		}
		return font;
	}
}
