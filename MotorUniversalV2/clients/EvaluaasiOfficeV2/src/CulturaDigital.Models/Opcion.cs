using System.Xml.Serialization;

namespace CulturaDigital.Models;

public class Opcion
{
	[XmlAttribute("OpcionId")]
	public int OpcionId { get; set; }

	[XmlAttribute("PreguntaId")]
	public int PreguntaId { get; set; }

	[XmlAttribute("Texto")]
	public string Texto { get; set; }

	[XmlAttribute("Orden")]
	public int Orden { get; set; }

	[XmlAttribute("Correcta")]
	public bool Correcta { get; set; }

	public bool Seleccionada { get; set; }

	public int OrdenSeleccionado { get; set; }

	public Opcion()
	{
	}

	public Opcion(int _OpcionId, int _PreguntaId, string _Texto, int _Orden, bool _Correcta)
	{
		OpcionId = _OpcionId;
		PreguntaId = _PreguntaId;
		Texto = _Texto;
		Orden = _Orden;
		Correcta = _Correcta;
	}
}
