using System;
using System.Collections.Generic;
using System.Xml.Serialization;

namespace CulturaDigital.Models;

[Serializable]
public class Tema
{
	[XmlAttribute("TemaId")]
	public int TemaId { get; set; }

	[XmlAttribute("CategoriaId")]
	public int CategoriaId { get; set; }

	[XmlAttribute("Nombre")]
	public string Nombre { get; set; }

	public List<Pregunta> Preguntas { get; set; }

	public int Correctas { get; set; }

	public decimal Calificacion { get; set; }
}
