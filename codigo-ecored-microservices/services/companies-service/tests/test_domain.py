import unittest

from companies.domain import CompanyValidationError, validate_company


class ValidateCompanyTest(unittest.TestCase):
    def test_normalizes_valid_company(self):
        result = validate_company(
            {
                "name": " Eco SAS ",
                "nit": "9001",
                "city": "Bogotá",
                "sector": "Reciclaje",
            },
        )
        self.assertEqual(result["name"], "Eco SAS")

    def test_rejects_missing_field(self):
        with self.assertRaises(CompanyValidationError):
            validate_company({"name": "Eco SAS"})
if __name__ == "__main__":
    unittest.main()
