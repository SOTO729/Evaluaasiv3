using System.Drawing;

namespace CulturaDigital.Models;

internal class Stegnography
{
	public enum State
	{
		Hiding,
		Filling_With_Zeros
	}

	public static Bitmap embedText(string text, Bitmap bmp)
	{
		State state = State.Hiding;
		int num = 0;
		int num2 = 0;
		long num3 = 0L;
		int num4 = 0;
		int num5 = 0;
		int num6 = 0;
		int num7 = 0;
		for (int i = 0; i < bmp.Height; i++)
		{
			for (int j = 0; j < bmp.Width; j++)
			{
				Color pixel = bmp.GetPixel(j, i);
				num5 = pixel.R - pixel.R % 2;
				num6 = pixel.G - pixel.G % 2;
				num7 = pixel.B - pixel.B % 2;
				for (int k = 0; k < 3; k++)
				{
					if (num3 % 8 == 0L)
					{
						if (state == State.Filling_With_Zeros && num4 == 8)
						{
							if ((num3 - 1) % 3 < 2)
							{
								bmp.SetPixel(j, i, Color.FromArgb(num5, num6, num7));
							}
							return bmp;
						}
						if (num >= text.Length)
						{
							state = State.Filling_With_Zeros;
						}
						else
						{
							num2 = text[num++];
						}
					}
					long num8 = num3 % 3;
					if ((ulong)num8 <= 2uL)
					{
						switch ((int)num8)
						{
						case 0:
							if (state == State.Hiding)
							{
								num5 += num2 % 2;
								num2 /= 2;
							}
							break;
						case 1:
							if (state == State.Hiding)
							{
								num6 += num2 % 2;
								num2 /= 2;
							}
							break;
						case 2:
							if (state == State.Hiding)
							{
								num7 += num2 % 2;
								num2 /= 2;
							}
							bmp.SetPixel(j, i, Color.FromArgb(num5, num6, num7));
							break;
						}
					}
					num3++;
					if (state == State.Filling_With_Zeros)
					{
						num4++;
					}
				}
			}
		}
		return bmp;
	}

	public static string extractText(Bitmap bmp)
	{
		int num = 0;
		int num2 = 0;
		string text = string.Empty;
		for (int i = 0; i < bmp.Height; i++)
		{
			for (int j = 0; j < bmp.Width; j++)
			{
				Color pixel = bmp.GetPixel(j, i);
				for (int k = 0; k < 3; k++)
				{
					switch (num % 3)
					{
					case 0:
						num2 = num2 * 2 + pixel.R % 2;
						break;
					case 1:
						num2 = num2 * 2 + pixel.G % 2;
						break;
					case 2:
						num2 = num2 * 2 + pixel.B % 2;
						break;
					}
					num++;
					if (num % 8 == 0)
					{
						num2 = reverseBits(num2);
						if (num2 == 0)
						{
							return text;
						}
						text += (char)num2;
					}
				}
			}
		}
		return text;
	}

	public static int reverseBits(int n)
	{
		int num = 0;
		for (int i = 0; i < 8; i++)
		{
			num = num * 2 + n % 2;
			n /= 2;
		}
		return num;
	}
}
