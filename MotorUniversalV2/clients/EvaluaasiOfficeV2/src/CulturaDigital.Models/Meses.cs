using System.Collections.Generic;

namespace CulturaDigital.Models;

public class Meses
{
	public int Valor { get; set; }

	public string Mes { get; set; }

	public Meses()
	{
	}

	public Meses(int _Valor, string _Mes)
	{
		Valor = _Valor;
		Mes = _Mes;
	}

	public List<Meses> CargarMeses()
	{
		return new List<Meses>
		{
			new Meses(1, "ENERO"),
			new Meses(2, "FEBRERO"),
			new Meses(3, "MARZO"),
			new Meses(4, "ABRIL"),
			new Meses(5, "MAYO"),
			new Meses(6, "JUNIO"),
			new Meses(7, "JULIO"),
			new Meses(8, "AGOSTO"),
			new Meses(9, "SEPTIEMBRE"),
			new Meses(10, "OCTUBRE"),
			new Meses(11, "NOVIEMBRE"),
			new Meses(12, "DICIEMBRE"),
			new Meses(13, "XML's")
		};
	}
}
