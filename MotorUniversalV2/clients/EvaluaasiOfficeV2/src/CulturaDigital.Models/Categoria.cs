using System;
using System.Collections.Generic;
using System.Xml.Serialization;

namespace CulturaDigital.Models;

[Serializable]
public class Categoria
{
	[XmlAttribute("CategoriaId")]
	public int CategoriaId { get; set; }

	[XmlAttribute("Nombre")]
	public string Nombre { get; set; }

	[XmlAttribute("Porcentaje")]
	public int Porcentaje { get; set; }

	public decimal Calificacion { get; set; }

	public List<Tema> Temas { get; set; }

	public List<Pregunta> Preguntas { get; set; }

	public Categoria()
	{
	}

	public Categoria(int _CategoriaId, string _Nombre, int _Porcentaje)
	{
		CategoriaId = _CategoriaId;
		Nombre = _Nombre;
		Porcentaje = _Porcentaje;
	}
}
