using System;
using System.Collections.Generic;
using System.Linq;

namespace CulturaDigital.Models.Extensions;

public static class ListExtensions
{
	private static Random random = new Random();

	public static T GetRandom<T>(this IList<T> list)
	{
		if (list.Count == 0)
		{
			return default(T);
		}
		return list[random.Next(0, list.Count)];
	}

	public static void Shuffle<T>(this IList<T> list)
	{
		if (list.Count > 1)
		{
			for (int i = 0; i < list.Count; i++)
			{
				int index = random.Next(0, list.Count);
				T value = list[i];
				list[i] = list[index];
				list[index] = value;
			}
		}
	}

	public static List<Pregunta> ShufflePreguntas(this List<Pregunta> list, List<Categoria> cats)
	{
		List<Pregunta> list2 = new List<Pregunta>();
		foreach (Categoria cat in cats)
		{
			foreach (Tema t in cat.Temas)
			{
				t.Preguntas = new List<Pregunta>();
				List<Pregunta> list3 = list.Where((Pregunta m) => m.TemaId == t.TemaId).ToList();
				list3.Shuffle();
				list2.Add(list3.First());
			}
		}
		return list2;
	}

	public static List<Pregunta> ShufflePreguntas(this List<Pregunta> list, List<Categoria> cats, int NoPreguntas)
	{
		List<Pregunta> list2 = new List<Pregunta>();
		(from m in list
			group m by m.TemaId).Count();
		foreach (Categoria cat in cats)
		{
			foreach (Tema t in cat.Temas)
			{
				t.Preguntas = new List<Pregunta>();
				List<Pregunta> list3 = list.Where((Pregunta m) => m.TemaId == t.TemaId).ToList();
				list3.Shuffle();
				list2.Add(list3.First());
			}
		}
		list2.Shuffle();
		return list2;
	}

	public static string GenerarDetalle(this IList<Pregunta> preguntas)
	{
		string text = "";
		foreach (Pregunta pregunta in preguntas)
		{
			IEnumerable<Opcion> enumerable = pregunta.Opciones.Where((Opcion m) => m.Correcta);
			IEnumerable<int> source = from m in pregunta.Opciones.Where((Opcion m) => m.Seleccionada).ToList()
				select m.OpcionId;
			string arg = string.Empty;
			if (pregunta.Estatus > 0 && pregunta.Correcta.ToLower().Equals("false"))
			{
				switch (pregunta.TipoPregunta)
				{
				case eTipoPregunta.OpcionMultiple:
					arg = string.Format("Opción múltiple: Respuesta incorrecta ({0})", string.Join(",", new List<int>(source.ToArray()).ConvertAll((int i) => i.ToString()).ToArray()));
					break;
				case eTipoPregunta.SeleccionMultiple:
				{
					int num4 = 0;
					foreach (Opcion item3 in enumerable)
					{
						if (source.Contains(item3.OpcionId))
						{
							num4++;
						}
					}
					arg = string.Format("Selección múltiple: {0}/{1} correctas ({2})", num4, enumerable.Count(), string.Join(",", new List<int>(source.ToArray()).ConvertAll((int i) => i.ToString()).ToArray()));
					break;
				}
				case eTipoPregunta.ArrastrarSoltar:
				{
					int num2 = 0;
					foreach (Opcion item4 in enumerable)
					{
						if (source.Contains(item4.OpcionId))
						{
							num2++;
						}
					}
					arg = string.Format("Arrastrar y soltar: {0}/{1} correctas ({2})", num2, enumerable.Count(), string.Join(",", new List<int>(source.ToArray()).ConvertAll((int i) => i.ToString()).ToArray()));
					break;
				}
				case eTipoPregunta.Ordenamiento:
				{
					int num3 = 0;
					foreach (Opcion item5 in enumerable)
					{
						if (source.Contains(item5.OpcionId))
						{
							num3++;
						}
					}
					arg = $"Ordenamiento: {num3}/{enumerable.Count()} correctas ";
					foreach (Opcion item2 in enumerable.OrderBy((Opcion q) => q.Orden).ToList())
					{
						Opcion opcion2 = pregunta.Opciones.Where((Opcion q) => q.OpcionId == item2.OpcionId).FirstOrDefault();
						arg = ((item2.Orden != opcion2.OrdenSeleccionado) ? (arg + $"{item2.Orden}: incorrecto ") : (arg + $"{item2.Orden}: correcto "));
					}
					source = (from m in pregunta.Opciones.Where((Opcion m) => m.Seleccionada).ToList()
						orderby m.OrdenSeleccionado
						select m.OpcionId).ToList();
					arg += string.Format("({0})", string.Join(",", new List<int>(source.ToArray()).ConvertAll((int i) => i.ToString()).ToArray()));
					break;
				}
				case eTipoPregunta.TrueFalse:
					arg = string.Format("Verdadero/Falso: Respuesta incorrecta ({0})", string.Join(",", new List<int>(source.ToArray()).ConvertAll((int i) => i.ToString()).ToArray()));
					break;
				case eTipoPregunta.OrdenarPanelDragDrop:
				{
					int num = 0;
					foreach (Opcion item6 in enumerable)
					{
						if (source.Contains(item6.OpcionId))
						{
							num++;
						}
					}
					arg = $"Arrastrar y ordenar: {num}/{enumerable.Count()} correctas ";
					foreach (Opcion item in enumerable.OrderBy((Opcion q) => q.Orden).ToList())
					{
						Opcion opcion = pregunta.Opciones.Where((Opcion q) => q.OpcionId == item.OpcionId).FirstOrDefault();
						arg = ((item.Orden != opcion.OrdenSeleccionado) ? (arg + $"{item.Orden}: incorrecto ") : (arg + $"{item.Orden}: correcto "));
					}
					source = (from m in pregunta.Opciones
						where m.Seleccionada
						orderby m.OrdenSeleccionado
						select m.OpcionId).ToList();
					arg += string.Format("({0})", string.Join(",", new List<int>(source.ToArray()).ConvertAll((int i) => i.ToString()).ToArray()));
					break;
				}
				}
			}
			switch (pregunta.Estatus)
			{
			case 0:
				text += $"{pregunta.PreguntaId.PonerCeros(2)}|{arg}|No respondida|";
				break;
			case 1:
				text += $"{pregunta.PreguntaId.PonerCeros(2)}|{arg}|Omitida|";
				break;
			case 2:
				text = (string.IsNullOrEmpty(pregunta.FechaRespuesta.ProcesarFecha()) ? (text + $"{pregunta.PreguntaId.PonerCeros(2)}|{arg}|Omitida sin respuesta|") : (text + $"{pregunta.PreguntaId.PonerCeros(2)}|{arg}|{pregunta.Correcta.TFString()}|"));
				break;
			}
		}
		return text;
	}
}
