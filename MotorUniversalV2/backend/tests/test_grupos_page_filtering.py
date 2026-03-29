"""
Tests de aislamiento de datos en la página /grupos (endpoint groups/search).
Verifica que coordinadores solo ven sus propios partners, planteles y grupos.

Escenarios:
  1. Coordinator A ve SOLO sus grupos en groups/search
  2. available_partners devuelve SOLO partners del coordinador
  3. available_cycles devuelve SOLO ciclos de los grupos del coordinador
  4. Filtro por partner_id funciona dentro del scope del coordinador
  5. Coordinator B NO ve los grupos de Coordinator A
  6. Admin ve TODOS los grupos (sin filtro)
  7. Búsqueda textual respeta el aislamiento del coordinador
  8. Paginación funciona correctamente con filtros de coordinador
"""

import time
import requests
import pytest

DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"


@pytest.fixture(scope="session")
def api():
    return DEV_API


@pytest.fixture(scope="session")
def admin_token(api):
    """Login as admin with retry for cold starts."""
    for attempt in range(3):
        r = requests.post(
            f"{api}/auth/login",
            json={"username": "admin", "password": "admin123"},
            timeout=30,
        )
        if r.status_code == 200:
            return r.json()["access_token"]
        if r.status_code in [502, 503]:
            time.sleep(10)
    pytest.fail("Admin login failed after 3 attempts")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def coordinators_data(api, admin_headers):
    """Find two different coordinators that each have at least one group."""
    r = requests.get(
        f"{api}/user-management/users?role=coordinator&per_page=50",
        headers=admin_headers,
        timeout=30,
    )
    assert r.status_code == 200
    coordinators = r.json().get("users", [])
    assert len(coordinators) >= 2, "Need at least 2 coordinators in DEV"

    coord_with_groups = []
    for coord in coordinators:
        # Generate a temp password for this coordinator
        gen_r = requests.post(
            f"{api}/user-management/users/{coord['id']}/generate-password",
            headers=admin_headers,
            timeout=30,
        )
        if gen_r.status_code != 200:
            continue
        temp_pwd = gen_r.json()["password"]

        # Login as this coordinator
        login_r = requests.post(
            f"{api}/auth/login",
            json={"username": coord["username"], "password": temp_pwd},
            timeout=30,
        )
        if login_r.status_code != 200:
            continue
        coord_token = login_r.json()["access_token"]
        coord_headers = {"Authorization": f"Bearer {coord_token}", "Content-Type": "application/json"}

        # Check if this coordinator has groups
        groups_r = requests.get(
            f"{api}/partners/groups/search?per_page=5",
            headers=coord_headers,
            timeout=30,
        )
        if groups_r.status_code == 200 and groups_r.json().get("total", 0) > 0:
            coord_with_groups.append({
                "id": coord["id"],
                "username": coord["username"],
                "token": coord_token,
                "headers": coord_headers,
                "total_groups": groups_r.json()["total"],
            })
        if len(coord_with_groups) >= 2:
            break

    if len(coord_with_groups) < 2:
        pytest.skip("Need at least 2 coordinators with groups in DEV")

    return coord_with_groups


@pytest.fixture(scope="session")
def coord_a(coordinators_data):
    return coordinators_data[0]


@pytest.fixture(scope="session")
def coord_b(coordinators_data):
    return coordinators_data[1]


class TestGruposPageCoordinatorFiltering:
    """Tests para la página /grupos — aislamiento de datos por coordinador."""

    def test_coord_a_sees_only_own_groups(self, api, coord_a, admin_headers):
        """T1: Coordinator A ve SOLO sus grupos en groups/search."""
        r = requests.get(
            f"{api}/partners/groups/search?per_page=500&active_only=false",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0, "Coordinator A should have groups"

        # Verify all groups belong to this coordinator by checking via admin
        for group in data["groups"]:
            detail = requests.get(
                f"{api}/partners/groups/{group['id']}",
                headers=admin_headers,
                timeout=30,
            )
            assert detail.status_code == 200
            group_data = detail.json().get("group", detail.json())
            assert group_data.get("coordinator_id") == coord_a["id"], (
                f"Group {group['id']} ({group['name']}) has coordinator_id="
                f"{group_data.get('coordinator_id')}, expected {coord_a['id']}"
            )

    def test_available_partners_only_coordinators_own(self, api, coord_a, admin_headers):
        """T2: available_partners devuelve SOLO los partners del coordinador."""
        r = requests.get(
            f"{api}/partners/groups/search?per_page=5",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r.status_code == 200
        available = r.json().get("available_partners", [])
        assert len(available) > 0, "Should have available partners"

        # Verify each partner belongs to this coordinator
        for partner in available:
            detail = requests.get(
                f"{api}/partners/{partner['id']}",
                headers=admin_headers,
                timeout=30,
            )
            assert detail.status_code == 200
            partner_data = detail.json().get("partner", detail.json())
            assert partner_data.get("coordinator_id") == coord_a["id"], (
                f"Available partner {partner['id']} ({partner['name']}) has "
                f"coordinator_id={partner_data.get('coordinator_id')}, expected {coord_a['id']}"
            )

    def test_coord_b_does_not_see_coord_a_groups(self, api, coord_a, coord_b):
        """T3: Coordinator B NO ve los grupos de Coordinator A."""
        # Get coord_a groups
        r_a = requests.get(
            f"{api}/partners/groups/search?per_page=500&active_only=false",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r_a.status_code == 200
        a_group_ids = {g["id"] for g in r_a.json()["groups"]}

        # Get coord_b groups
        r_b = requests.get(
            f"{api}/partners/groups/search?per_page=500&active_only=false",
            headers=coord_b["headers"],
            timeout=30,
        )
        assert r_b.status_code == 200
        b_group_ids = {g["id"] for g in r_b.json()["groups"]}

        # No overlap
        overlap = a_group_ids & b_group_ids
        assert len(overlap) == 0, (
            f"Coordinators share {len(overlap)} groups (IDs: {overlap}). "
            f"Groups should be fully isolated."
        )

    def test_coord_b_available_partners_different(self, api, coord_a, coord_b):
        """T4: Available partners son diferentes entre coordinadores."""
        r_a = requests.get(
            f"{api}/partners/groups/search?per_page=5",
            headers=coord_a["headers"],
            timeout=30,
        )
        r_b = requests.get(
            f"{api}/partners/groups/search?per_page=5",
            headers=coord_b["headers"],
            timeout=30,
        )
        assert r_a.status_code == 200
        assert r_b.status_code == 200

        a_partner_ids = {p["id"] for p in r_a.json().get("available_partners", [])}
        b_partner_ids = {p["id"] for p in r_b.json().get("available_partners", [])}

        # Partners should not overlap between coordinators
        overlap = a_partner_ids & b_partner_ids
        assert len(overlap) == 0, (
            f"Coordinators share {len(overlap)} available partners (IDs: {overlap}). "
            f"Available partners should be isolated."
        )

    def test_admin_sees_all_groups(self, api, admin_headers, coord_a, coord_b):
        """T5: Admin ve TODOS los grupos, más que cualquier coordinador individual."""
        r_admin = requests.get(
            f"{api}/partners/groups/search?per_page=500&active_only=false",
            headers=admin_headers,
            timeout=30,
        )
        assert r_admin.status_code == 200
        admin_total = r_admin.json()["total"]

        # Admin should see more groups than either coordinator
        assert admin_total >= coord_a["total_groups"], (
            f"Admin sees {admin_total} groups, coord_a sees {coord_a['total_groups']}"
        )
        assert admin_total >= coord_b["total_groups"]
        # Admin total >= sum of both coordinators (there may be groups from other coords too)
        assert admin_total >= coord_a["total_groups"] + coord_b["total_groups"], (
            f"Admin ({admin_total}) should see at least the combined groups of coord_a ({coord_a['total_groups']}) "
            f"+ coord_b ({coord_b['total_groups']})"
        )

    def test_partner_filter_respects_isolation(self, api, coord_a, coord_b):
        """T6: Filtrar por partner_id de otro coordinador devuelve 0 resultados."""
        # Get coord_b's partners
        r_b = requests.get(
            f"{api}/partners/groups/search?per_page=5",
            headers=coord_b["headers"],
            timeout=30,
        )
        assert r_b.status_code == 200
        b_partners = r_b.json().get("available_partners", [])
        if not b_partners:
            pytest.skip("Coord B has no available partners")

        # Coord A tries to filter by coord B's partner
        r_a = requests.get(
            f"{api}/partners/groups/search?partner_id={b_partners[0]['id']}&per_page=5",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r_a.status_code == 200
        assert r_a.json()["total"] == 0, (
            f"Coord A should see 0 groups when filtering by coord B's partner, "
            f"but sees {r_a.json()['total']}"
        )

    def test_search_respects_isolation(self, api, coord_a, coord_b):
        """T7: Búsqueda textual respeta el aislamiento."""
        # Get a group name from coord_b
        r_b = requests.get(
            f"{api}/partners/groups/search?per_page=1",
            headers=coord_b["headers"],
            timeout=30,
        )
        assert r_b.status_code == 200
        b_groups = r_b.json()["groups"]
        if not b_groups:
            pytest.skip("Coord B has no groups")

        target_name = b_groups[0]["name"]

        # Coord A searches for coord B's group name
        r_a = requests.get(
            f"{api}/partners/groups/search?search={target_name}&per_page=10",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r_a.status_code == 200
        a_group_names = [g["name"] for g in r_a.json()["groups"]]
        assert target_name not in a_group_names, (
            f"Coord A should NOT find coord B's group '{target_name}' via search"
        )

    def test_pagination_correct_with_filtering(self, api, coord_a):
        """T8: Paginación funciona correctamente con filtros de coordinador."""
        # Get total
        r_all = requests.get(
            f"{api}/partners/groups/search?per_page=500&active_only=false",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r_all.status_code == 200
        total = r_all.json()["total"]

        if total <= 1:
            pytest.skip("Need more than 1 group for pagination test")

        # Get page 1 with per_page=1
        r_p1 = requests.get(
            f"{api}/partners/groups/search?page=1&per_page=1&active_only=false",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r_p1.status_code == 200
        p1_data = r_p1.json()
        assert p1_data["page"] == 1
        assert p1_data["total"] == total
        assert p1_data["pages"] == total  # total / per_page(1) = total
        assert len(p1_data["groups"]) == 1

        # Get page 2
        r_p2 = requests.get(
            f"{api}/partners/groups/search?page=2&per_page=1&active_only=false",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r_p2.status_code == 200
        p2_data = r_p2.json()
        assert p2_data["page"] == 2
        assert len(p2_data["groups"]) == 1
        # Different group
        assert p1_data["groups"][0]["id"] != p2_data["groups"][0]["id"]

    def test_groups_show_correct_partner_campus(self, api, coord_a):
        """T9: Cada grupo muestra partner y campus correctos (no nulos)."""
        r = requests.get(
            f"{api}/partners/groups/search?per_page=500&active_only=false",
            headers=coord_a["headers"],
            timeout=30,
        )
        assert r.status_code == 200
        for group in r.json()["groups"]:
            assert group.get("partner_name"), (
                f"Group {group['id']} ({group['name']}) has no partner_name"
            )
            assert group.get("campus_name"), (
                f"Group {group['id']} ({group['name']}) has no campus_name"
            )
            assert group.get("partner_id"), (
                f"Group {group['id']} ({group['name']}) has no partner_id"
            )
            assert group.get("campus_id"), (
                f"Group {group['id']} ({group['name']}) has no campus_id"
            )

    def test_partners_endpoint_also_filtered(self, api, coord_a, admin_headers):
        """T10: GET /partners también filtra correctamente para coordinadores."""
        r_coord = requests.get(
            f"{api}/partners?per_page=200",
            headers=coord_a["headers"],
            timeout=30,
        )
        r_admin = requests.get(
            f"{api}/partners?per_page=200",
            headers=admin_headers,
            timeout=30,
        )
        assert r_coord.status_code == 200
        assert r_admin.status_code == 200

        coord_partner_ids = {p["id"] for p in r_coord.json()["partners"]}
        admin_partner_ids = {p["id"] for p in r_admin.json()["partners"]}

        # Coordinator should see fewer or equal partners than admin
        assert len(coord_partner_ids) <= len(admin_partner_ids), (
            f"Coordinator sees {len(coord_partner_ids)} partners, admin sees {len(admin_partner_ids)}"
        )

        # All coordinator partners should be in admin's list
        assert coord_partner_ids.issubset(admin_partner_ids), (
            f"Coordinator sees partners not visible to admin: {coord_partner_ids - admin_partner_ids}"
        )

        # Verify each partner belongs to coordinator
        for p in r_coord.json()["partners"]:
            assert p.get("coordinator_id") == coord_a["id"], (
                f"Partner {p['id']} ({p['name']}) has coordinator_id={p.get('coordinator_id')}, "
                f"expected {coord_a['id']}"
            )
