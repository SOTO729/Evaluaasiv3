using System.Collections.Generic;
using CulturaDigital.Models.Extensions;

namespace CulturaDigital.Models;

public class Encripcion
{
	public string TextoNormal1 { get; set; }

	public string TextoEncriptado { get; set; }

	public string TextoInvertido { get; set; }

	public string TextoNormal2 { get; set; }

	public Meses MesEncripcion { get; set; }

	public char[] Normales { get; set; }

	public char[] Encriptados { get; set; }

	public char[] Invertidos { get; set; }

	public List<Elemento> Elementos { get; set; }

	public Encripcion()
	{
	}

	public Encripcion(string _TextoNormal1)
	{
		TextoNormal1 = _TextoNormal1;
		TextoEncriptado = _TextoNormal1.EncriptaTexto(MesEncripcion);
	}

	public Encripcion(string _TextoNormal1, Meses _mes)
	{
		MesEncripcion = _mes;
		TextoNormal1 = _TextoNormal1;
		List<Elemento> ele = new List<Elemento>();
		TextoEncriptado = _TextoNormal1.EncriptaTexto(MesEncripcion, ref ele);
		Elementos = ele;
		TextoInvertido = TextoEncriptado.ReverseString();
		TextoNormal2 = TextoInvertido.ReverseString().DesencriptaTexto(_mes);
	}

	public Encripcion(Meses _mes, string _TextoEncriptado)
	{
		MesEncripcion = _mes;
		TextoEncriptado = _TextoEncriptado;
		List<Elemento> ele = new List<Elemento>();
		TextoNormal2 = TextoEncriptado.ReverseString().DesencriptaTexto(_mes, ref ele);
		Elementos = ele;
	}

	public Encripcion(int valor, string _TextoEncriptado)
	{
		MesEncripcion = new Meses();
		MesEncripcion.Valor = valor;
		TextoEncriptado = _TextoEncriptado;
		TextoNormal2 = TextoEncriptado.ReverseString().DesencriptaTexto(MesEncripcion);
	}
}
