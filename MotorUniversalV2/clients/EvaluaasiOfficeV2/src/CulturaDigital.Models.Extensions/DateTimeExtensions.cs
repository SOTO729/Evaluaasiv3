using System;

namespace CulturaDigital.Models.Extensions;

public static class DateTimeExtensions
{
	public static string ProcesarFecha(this DateTime fecha)
	{
		string text = "";
		if (fecha > DateTime.MinValue)
		{
			text = fecha.Day.PonerCeros(2) + "/";
			text = text + fecha.Month.PonerCeros(2) + "/";
			text = text + fecha.Year.PonerCeros(4) + " ";
			text = text + fecha.Hour.PonerCeros(2) + ":";
			text = text + fecha.Minute.PonerCeros(2) + ":";
			return text + fecha.Second.PonerCeros(2);
		}
		return string.Empty;
	}

	public static string ProcesarFechaSinHora(this DateTime fecha)
	{
		string text = "";
		if (fecha > DateTime.MinValue)
		{
			text = fecha.Day.PonerCeros(2) + "/";
			text = text + fecha.Month.PonerCeros(2) + "/";
			return text + fecha.Year.PonerCeros(4) + " ";
		}
		return string.Empty;
	}

	public static decimal FechaDecimal(this DateTime fecha)
	{
		decimal num = default(decimal);
		try
		{
			DateTime dateTime = new DateTime(1900, 1, 1);
			return (decimal)(fecha.AddDays(-1.0) - dateTime).TotalDays;
		}
		catch (Exception)
		{
			num = default(decimal);
		}
		return num;
	}
}
