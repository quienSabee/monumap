#!/usr/bin/env python3
"""
Post-process an SVG plan so tomb-like elements become individually addressable.

The script performs three steps:
1. Finds rendered SVG elements outside <defs> that represent tombs:
   - any rendered element whose fill matches the target color
   - any rendered <circle> whose fill is black
2. Splits every matching <path> that contains multiple subpaths into one <path> per subpath.
3. Annotates every matching element with:
   - class="<class-name>"
   - preserves existing tomb ids when already present
   - assigns a new numeric id only to tombs that do not have one yet
   - data-monumap-tomb-id mirrors the preserved or assigned tomb id

Usage examples:
  python scripts/process_plan_svg.py public/plan.svg
  python scripts/process_plan_svg.py public/plan.svg --output public/plan.processed.svg
  python scripts/process_plan_svg.py public/plan.svg --fill-color "#a09387" --class-name tomb
"""

from __future__ import annotations

import argparse
import copy
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

TOKEN_RE = re.compile(r"[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
COMMAND_RE = re.compile(r"[AaCcHhLlMmQqSsTtVvZz]")
PARAM_COUNTS = {
    "L": 2,
    "H": 1,
    "V": 1,
    "C": 6,
    "S": 4,
    "Q": 4,
    "T": 2,
    "A": 7,
}
BLACK_CIRCLE_FILLS = {"#000", "#000000", "#1d1d1b", "black"}


@dataclass
class ProcessingStats:
    split_path_elements: int = 0
    added_path_elements: int = 0
    annotated_tombs: int = 0
    remaining_multi_subpath_paths: int = 0


def collect_namespaces(svg_path: Path) -> list[tuple[str, str]]:
    namespaces: list[tuple[str, str]] = []
    for event, item in ET.iterparse(svg_path, events=("start-ns",)):
        if event != "start-ns":
            continue
        prefix, uri = item
        if (prefix, uri) not in namespaces:
            namespaces.append((prefix, uri))
    return namespaces


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Split and annotate tomb elements inside an SVG plan.")
    parser.add_argument("input", type=Path, help="Input SVG file")
    parser.add_argument(
        "--output",
        type=Path,
        help="Output SVG file. If omitted, the input file is overwritten.",
    )
    parser.add_argument(
        "--fill-color",
        default="#a09387",
        help="Fill color used to identify tombs. Default: #a09387",
    )
    parser.add_argument(
        "--class-name",
        default="tomb",
        help='Class assigned to detected tombs. Default: "tomb"',
    )
    return parser.parse_args()


def local_name(tag: str) -> str:
    return tag.split("}")[-1]


def iter_rendered_elements(element: ET.Element):
    for child in list(element):
        if local_name(child.tag) == "defs":
            continue
        yield child
        yield from iter_rendered_elements(child)


def get_fill_color(element: ET.Element) -> str | None:
    fill = element.attrib.get("fill")
    if fill:
        return fill.strip().lower()

    style = element.attrib.get("style", "")
    match = re.search(r"(?i)(?:^|;)\s*fill\s*:\s*([^;]+)", style)
    if match:
        return match.group(1).strip().lower()

    return None


def is_black_tomb_circle(element: ET.Element) -> bool:
    return local_name(element.tag) == "circle" and get_fill_color(element) in BLACK_CIRCLE_FILLS


def is_tomb_candidate(element: ET.Element, fill_color: str) -> bool:
    return get_fill_color(element) == fill_color or is_black_tomb_circle(element)


def fmt_number(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.12g}"


def emit_command(command: str, params: list[float]) -> str:
    if not params:
        return command
    return f"{command} {' '.join(fmt_number(param) for param in params)}"


def apply_command_state(
    command: str,
    params: list[float],
    current_x: float,
    current_y: float,
    start_x: float,
    start_y: float,
) -> tuple[float, float, float, float]:
    upper = command.upper()

    if upper == "Z":
        return start_x, start_y, start_x, start_y

    if upper == "L":
        for index in range(0, len(params), 2):
            x, y = params[index : index + 2]
            if command.islower():
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
        return current_x, current_y, start_x, start_y

    if upper == "H":
        for value in params:
            current_x = current_x + value if command.islower() else value
        return current_x, current_y, start_x, start_y

    if upper == "V":
        for value in params:
            current_y = current_y + value if command.islower() else value
        return current_x, current_y, start_x, start_y

    if upper == "C":
        for index in range(0, len(params), 6):
            x, y = params[index + 4], params[index + 5]
            if command.islower():
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
        return current_x, current_y, start_x, start_y

    if upper == "S":
        for index in range(0, len(params), 4):
            x, y = params[index + 2], params[index + 3]
            if command.islower():
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
        return current_x, current_y, start_x, start_y

    if upper == "Q":
        for index in range(0, len(params), 4):
            x, y = params[index + 2], params[index + 3]
            if command.islower():
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
        return current_x, current_y, start_x, start_y

    if upper == "T":
        for index in range(0, len(params), 2):
            x, y = params[index], params[index + 1]
            if command.islower():
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
        return current_x, current_y, start_x, start_y

    if upper == "A":
        for index in range(0, len(params), 7):
            x, y = params[index + 5], params[index + 6]
            if command.islower():
                current_x += x
                current_y += y
            else:
                current_x = x
                current_y = y
        return current_x, current_y, start_x, start_y

    raise ValueError(f"Unsupported SVG path command: {command}")


def split_path_data(path_data: str) -> list[str]:
    tokens = TOKEN_RE.findall(path_data.replace(",", " "))
    if not tokens:
        return [path_data]

    subpaths: list[str] = []
    current_parts: list[str] = []
    current_x = 0.0
    current_y = 0.0
    start_x = 0.0
    start_y = 0.0
    command: str | None = None
    index = 0

    while index < len(tokens):
        token = tokens[index]
        if COMMAND_RE.fullmatch(token):
            command = token
            index += 1
        elif command is None:
            raise ValueError("Path data does not start with a command.")

        if command is None:
            break

        if command.upper() == "Z":
            current_parts.append(command)
            current_x, current_y = start_x, start_y
            command = None
            continue

        params: list[float] = []
        while index < len(tokens) and not COMMAND_RE.fullmatch(tokens[index]):
            params.append(float(tokens[index]))
            index += 1

        if command.upper() == "M":
            if len(params) < 2 or len(params) % 2 != 0:
                raise ValueError(f"Invalid moveto parameters: {params}")

            if current_parts:
                subpaths.append(" ".join(current_parts))
                current_parts = []

            move_x, move_y = params[0], params[1]
            if command == "m":
                move_x += current_x
                move_y += current_y

            current_x = move_x
            current_y = move_y
            start_x = move_x
            start_y = move_y
            current_parts.append(emit_command("M", [move_x, move_y]))

            if len(params) > 2:
                remaining = params[2:]
                implicit_command = "l" if command == "m" else "L"
                current_parts.append(emit_command(implicit_command, remaining))
                current_x, current_y, start_x, start_y = apply_command_state(
                    implicit_command,
                    remaining,
                    current_x,
                    current_y,
                    start_x,
                    start_y,
                )
            continue

        expected = PARAM_COUNTS.get(command.upper())
        if expected is None or len(params) % expected != 0:
            raise ValueError(f"Invalid parameters for command {command}: {params}")

        if params:
            current_parts.append(emit_command(command, params))
            current_x, current_y, start_x, start_y = apply_command_state(
                command,
                params,
                current_x,
                current_y,
                start_x,
                start_y,
            )

    if current_parts:
        subpaths.append(" ".join(current_parts))

    return subpaths or [path_data]


def split_matching_paths(parent: ET.Element, fill_color: str) -> tuple[int, int]:
    split_count = 0
    added_count = 0
    rebuilt_children: list[ET.Element] = []

    for child in list(parent):
        if local_name(child.tag) != "defs":
            child_split_count, child_added_count = split_matching_paths(child, fill_color)
            split_count += child_split_count
            added_count += child_added_count

        is_split_target = (
            local_name(child.tag) == "path"
            and is_tomb_candidate(child, fill_color)
            and child.attrib.get("d")
        )

        if is_split_target:
            parts = split_path_data(child.attrib["d"])
            if len(parts) > 1:
                split_count += 1
                added_count += len(parts) - 1
                tail = child.tail
                for part_index, part in enumerate(parts):
                    clone = copy.deepcopy(child)
                    clone.attrib["d"] = part
                    if part_index > 0:
                        clone.attrib.pop("id", None)
                        clone.attrib.pop("data-monumap-tomb-id", None)
                        clone.attrib.pop("data-legacy-id", None)
                    clone.tail = tail if part_index == len(parts) - 1 else None
                    rebuilt_children.append(clone)
                continue

        rebuilt_children.append(child)

    parent[:] = rebuilt_children
    return split_count, added_count


def next_available_numeric_id(used_ids: set[str]) -> str:
    numeric_ids = [int(value) for value in used_ids if value.isdigit()]
    next_id = max(numeric_ids, default=0) + 1
    while str(next_id) in used_ids:
        next_id += 1
    return str(next_id)


def annotate_tombs(root: ET.Element, fill_color: str, class_name: str) -> int:
    annotated_count = 0
    used_tomb_ids: set[str] = set()

    for element in iter_rendered_elements(root):
        if not is_tomb_candidate(element, fill_color):
            continue

        existing_tomb_id = element.attrib.get("data-monumap-tomb-id", "").strip()
        existing_dom_id = element.attrib.get("id", "").strip()

        if existing_tomb_id:
            used_tomb_ids.add(existing_tomb_id)
        if existing_dom_id:
            used_tomb_ids.add(existing_dom_id)

    for element in iter_rendered_elements(root):
        if not is_tomb_candidate(element, fill_color):
            continue

        annotated_count += 1
        existing_tomb_id = element.attrib.get("data-monumap-tomb-id", "").strip()
        existing_dom_id = element.attrib.get("id", "").strip()
        tomb_id = existing_tomb_id or existing_dom_id

        if not tomb_id:
            tomb_id = next_available_numeric_id(used_tomb_ids)
            used_tomb_ids.add(tomb_id)

        if not existing_dom_id:
            element.attrib["id"] = tomb_id

        element.attrib["data-monumap-tomb-id"] = tomb_id

        classes = [token for token in element.attrib.get("class", "").split() if token]
        if class_name not in classes:
            classes.append(class_name)

        element.attrib["class"] = " ".join(classes)
    return annotated_count


def count_remaining_multi_subpaths(root: ET.Element, fill_color: str, class_name: str) -> int:
    count = 0
    for element in iter_rendered_elements(root):
        if local_name(element.tag) != "path":
            continue
        classes = element.attrib.get("class", "").split()
        if class_name not in classes:
            continue
        if not is_tomb_candidate(element, fill_color):
            continue
        path_data = element.attrib.get("d", "")
        moveto_count = path_data.count("M") + path_data.count("m")
        if moveto_count > 1:
            count += 1
    return count


def write_tree(
    tree: ET.ElementTree,
    output_path: Path,
    keep_declaration: bool,
    namespaces: list[tuple[str, str]],
) -> None:
    for prefix, uri in namespaces:
        ET.register_namespace(prefix, uri)
    xml_text = ET.tostring(tree.getroot(), encoding="unicode", short_empty_elements=True)
    if keep_declaration:
        xml_text = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_text
    output_path.write_text(xml_text, encoding="utf-8")


def main() -> int:
    args = parse_args()
    input_path: Path = args.input
    output_path: Path = args.output or args.input
    fill_color = args.fill_color.strip().lower()
    class_name = args.class_name.strip()

    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 1

    original_text = input_path.read_text(encoding="utf-8")
    keep_declaration = original_text.lstrip().startswith("<?xml")
    namespaces = collect_namespaces(input_path)

    tree = ET.parse(input_path)
    root = tree.getroot()

    split_count, added_count = split_matching_paths(root, fill_color)
    annotated_count = annotate_tombs(root, fill_color, class_name)
    remaining_multi_subpaths = count_remaining_multi_subpaths(root, fill_color, class_name)

    write_tree(tree, output_path, keep_declaration, namespaces)

    stats = ProcessingStats(
        split_path_elements=split_count,
        added_path_elements=added_count,
        annotated_tombs=annotated_count,
        remaining_multi_subpath_paths=remaining_multi_subpaths,
    )

    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print(f"Fill color: {fill_color}")
    print(f"Class name: {class_name}")
    print(f"Split path elements: {stats.split_path_elements}")
    print(f"Added path elements: {stats.added_path_elements}")
    print(f"Annotated tombs: {stats.annotated_tombs}")
    print(f"Remaining multi-subpath tomb paths: {stats.remaining_multi_subpath_paths}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
