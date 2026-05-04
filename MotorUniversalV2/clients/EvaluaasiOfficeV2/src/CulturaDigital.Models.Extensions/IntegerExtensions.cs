namespace CulturaDigital.Models.Extensions;

public static class IntegerExtensions
{
	public static string PonerCeros(this int value, int digitos)
	{
		string text = "";
		if (value.ToString().Length < digitos)
		{
			for (int i = value.ToString().Length; i < digitos; i++)
			{
				text += "0";
			}
		}
		return text + value;
	}

	public static string NoOportunidad(this int value)
	{
		string result = "";
		switch (value)
		{
		case 1:
			result = "primera";
			break;
		case 2:
			result = "segunda";
			break;
		case 3:
			result = "tercera";
			break;
		case 4:
			result = "cuarta";
			break;
		case 5:
			result = "quinta";
			break;
		case 6:
			result = "sexta";
			break;
		case 7:
			result = "septima";
			break;
		case 8:
			result = "octava";
			break;
		case 9:
			result = "novena";
			break;
		case 10:
			result = "decimaa";
			break;
		}
		return result;
	}

	public static string SubSistemaInicial(this int value)
	{
		string result = "";
		switch (value)
		{
		case 1:
			result = "A";
			break;
		case 2:
			result = "B";
			break;
		case 3:
			result = "C";
			break;
		case 4:
			result = "D";
			break;
		case 5:
			result = "E";
			break;
		case 7:
			result = "D";
			break;
		case 8:
			result = "P";
			break;
		case 9:
			result = "Y";
			break;
		case 10:
			result = "H";
			break;
		case 11:
			result = "I";
			break;
		case 12:
			result = "J";
			break;
		case 13:
			result = "Z";
			break;
		case 16:
			result = "K";
			break;
		}
		return result;
	}

	public static string GetLetraMesDesencriptar(this int mesString)
	{
		string result = "";
		switch (mesString)
		{
		case 1:
			result = "L";
			break;
		case 2:
			result = "K";
			break;
		case 3:
			result = "J";
			break;
		case 4:
			result = "I";
			break;
		case 5:
			result = "H";
			break;
		case 6:
			result = "G";
			break;
		case 7:
			result = "F";
			break;
		case 8:
			result = "E";
			break;
		case 9:
			result = "D";
			break;
		case 10:
			result = "C";
			break;
		case 11:
			result = "B";
			break;
		case 12:
			result = "A";
			break;
		}
		return result;
	}
}
