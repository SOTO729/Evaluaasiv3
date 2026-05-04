using System;
using System.Collections.Generic;
using System.Xml.Linq;

namespace CulturaDigital.Models.Extensions;

public static class XDocumentExtensions
{
	public static List<Pregunta> ToListPreguntas(this XDocument doc)
	{
		List<Pregunta> list = new List<Pregunta>();
		try
		{
			foreach (XElement item in doc.Descendants("Preguntas").Descendants("Pregunta"))
			{
				int preguntaId = int.Parse(item.Attribute("PreguntaId").Value.ToString());
				int noPregunta = int.Parse(item.Attribute("NoPregunta").Value.ToString());
				string texto = item.Attribute("Texto").Value.ToString();
				eTipoPregunta tipoPregunta = (eTipoPregunta)int.Parse(item.Attribute("TipoPregunta").Value.ToString());
				eStatusPregunta statusPregunta = (eStatusPregunta)int.Parse(item.Attribute("StatusPregunta").Value.ToString());
				Pregunta pregunta = new Pregunta(preguntaId, noPregunta, texto, tipoPregunta, statusPregunta);
				foreach (XElement item2 in item.Descendants("Oportunidad"))
				{
					int opcionId = int.Parse(item2.Attribute("OportunidadId").Value.ToString());
					int preguntaId2 = int.Parse(item2.Attribute("PreguntaId").Value.ToString());
					string texto2 = item2.Attribute("Texto").Value.ToString();
					int orden = int.Parse(item2.Attribute("Orden").Value.ToString());
					bool correcta = bool.Parse(item2.Attribute("Correcta").Value.ToString());
					pregunta.Opciones.Add(new Opcion(opcionId, preguntaId2, texto2, orden, correcta));
				}
				list.Add(pregunta);
			}
		}
		catch (Exception)
		{
		}
		return list;
	}

	public static object GetPropValue(object src, string propName)
	{
		return src.GetType().GetProperty(propName).GetValue(src, null);
	}
}
