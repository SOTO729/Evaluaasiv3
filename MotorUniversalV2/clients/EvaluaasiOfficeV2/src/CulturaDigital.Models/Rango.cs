namespace CulturaDigital.Models;

public class Rango
{
	public char[] arreglo { get; set; }

	public int Inicio1 { get; set; }

	public int Inicio2 { get; set; }

	public int Fin1 { get; set; }

	public int Fin2 { get; set; }

	public Rango(int _Inicio1, int _Fin1, int _Inicio2, int _Fin2)
	{
		Inicio1 = _Inicio1;
		Fin1 = _Fin1;
		Inicio2 = _Inicio2;
		Fin2 = _Fin2;
	}

	public Rango()
	{
		arreglo = new char[190];
		int num = 0;
		for (int i = 0; i < 256; i++)
		{
			if ((i > 31 && i < 127) || (i > 160 && i < 256))
			{
				arreglo[num] = (char)i;
				num++;
			}
		}
	}
}
