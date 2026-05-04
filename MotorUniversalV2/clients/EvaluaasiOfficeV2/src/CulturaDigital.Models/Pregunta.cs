using System;
using System.Collections.Generic;
using System.Xml.Serialization;

namespace CulturaDigital.Models;

[Serializable]
public class Pregunta
{
	[XmlAttribute("PreguntaId")]
	public int PreguntaId { get; set; }

	[XmlAttribute("NoPregunta")]
	public int NoPregunta { get; set; }

	[XmlAttribute("Texto")]
	public string Texto { get; set; }

	[XmlAttribute("Mostrar")]
	public eMostrar Mostrar { get; set; }

	[XmlAttribute("TipoPregunta")]
	public eTipoPregunta TipoPregunta { get; set; }

	[XmlAttribute("StatusPregunta")]
	public eStatusPregunta StatusPregunta { get; set; }

	[XmlAttribute("Correcta")]
	public string Correcta { get; set; }

	[XmlAttribute("CategoriaId")]
	public int CategoriaId { get; set; }

	[XmlAttribute("TemaId")]
	public int TemaId { get; set; }

	public string Respuesta { get; set; }

	public DateTime FechaRespuesta { get; set; }

	public string Eventos { get; set; }

	public int Estatus { get; set; }

	public List<Opcion> Opciones { get; set; }

	public Pregunta()
	{
	}

	public Pregunta(int _PreguntaId, int _NoPregunta, string _Texto, eTipoPregunta _TipoPregunta, eStatusPregunta _StatusPregunta)
	{
		PreguntaId = _PreguntaId;
		NoPregunta = _NoPregunta;
		Texto = _Texto;
		TipoPregunta = _TipoPregunta;
		StatusPregunta = _StatusPregunta;
		Correcta = "false";
		Respuesta = "";
		Opciones = new List<Opcion>();
	}
}
