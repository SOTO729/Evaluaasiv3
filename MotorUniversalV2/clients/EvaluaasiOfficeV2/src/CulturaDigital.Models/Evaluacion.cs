using System;
using System.Collections.Generic;
using System.Xml.Serialization;

namespace CulturaDigital.Models;

[Serializable]
public class Evaluacion
{
	[XmlAttribute("EvaluacionId")]
	public int EvaluacionId { get; set; }

	[XmlAttribute("Nombre")]
	public string Nombre { get; set; }

	[XmlAttribute("NoPreguntas")]
	public int NoPreguntas { get; set; }

	[XmlAttribute("Minutos")]
	public int Minutos { get; set; }

	[XmlAttribute("Version")]
	public string Version { get; set; }

	[XmlAttribute("VersionApp")]
	public string VersionApp { get; set; }

	[XmlAttribute("VersionSimulador")]
	public string VersionSimulador { get; set; }

	public List<Pregunta> Preguntas { get; set; }

	public List<Categoria> Categorias { get; set; }
}
