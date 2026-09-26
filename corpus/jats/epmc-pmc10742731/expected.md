# Minimal Linear Codes Constructed from Sunflowers

Xia Wu, Wei Lu  
*Entropy*, 2023, 25(12), 1669  
DOI: 10.3390/e25121669 · PMID: 38136549 · PMCID: PMC10742731  
License: <https://creativecommons.org/licenses/by/4.0/>

## Abstract

Sunflower in coding theory is a class of important subspace codes and can be used to construct linear codes. In this paper, we study the minimality of linear codes over $\mathbb{F}_q$ constructed from sunflowers of size *s* in all cases. For any sunflower, the corresponding linear code is minimal if $s≥q+1$, and not minimal if $2≤s≤3≤q$. In the case where $3<s≤q$, for some sunflowers, the corresponding linear codes are minimal, whereas for some other sunflowers, the corresponding linear codes are not minimal.

## 1 **Introduction**

Let $\mathbb{F}_q$ be the finite field with *q* elements and $\mathbb{F}_q^n$ the vector space with dimension *n* over $\mathbb{F}_q$. For a vector $\mathbf{v}=(v_1,…,v_n)∈\mathbb{F}_q^n$, let Suppt$(\mathbf{v}):=\{1≤i≤n:v_i≠0\}$ be the support of $\mathbf{v}$. The *Hamming weight* of $\mathbf{v}$ is wt$(\mathbf{v})$:=#$\mathrm{Suppt}(\mathbf{v})$. For any two vectors $\mathbf{u},\mathbf{v}∈\mathbb{F}_q^n$, if $\mathrm{Suppt}(\mathbf{u})⊆\mathrm{Suppt}(\mathbf{v})$, we say that $\mathbf{v}$ covers $\mathbf{u}$ (or $\mathbf{u}$ is covered by $\mathbf{v}$) and write $\mathbf{u}⪯\mathbf{v}$. Clearly, $a\mathbf{v}⪯\mathbf{v}$ for all $a∈\mathbb{F}_q$.

An $[n,m]_q$ linear code $\mathcal{C}$ over $\mathbb{F}_q$ is an *m*-dimensional subspace of $\mathbb{F}_q^n$. A codeword $\mathbf{c}$ in a linear code $\mathcal{C}$ is called *minimal* if $\mathbf{c}$ covers only the codewords $a\mathbf{c}$ for all $a∈\mathbb{F}_q$, but no other codewords in $\mathcal{C}$. If every codeword in $\mathcal{C}$ is minimal, then $\mathcal{C}$ is said to be a *minimal linear code*. Minimal linear codes have interesting applications in secret sharing [1,2,3,4,5] and secure two-party computation [6,7], and could be decoded with a minimum distance decoding method [8].

Up to now, there are two approaches to studying minimal linear codes. One is the algebraic method and the other is the geometric method. The algebraic method is based on the Hamming weights of the codewords. In [8], Ashikhmin and Barg gave a sufficient condition for a linear code to be minimal. Many minimal linear codes satisfying the condition $\frac{w_{\mathrm{m}in}}{w_{\mathrm{m}ax}}>\frac{q−1}{q}$ are obtained from linear codes with few weights; for example [9,10]. Cohen et al. [7] provided an example to show that the condition $\frac{w_{\mathrm{m}in}}{w_{\mathrm{m}ax}}>\frac{q−1}{q}$ is not necessary for a linear code to be minimal. Ding, Heng, and Zhou [11,12] derived a sufficient and necessary condition on all Hamming weights for a given linear code to be minimal.

When using the algebraic method to prove the minimality of a given linear code, one needs to know all the Hamming weights in the code, which is very difficult in general. Even if all the Hamming weights are known, it is hard to use the algebraic method to prove the minimality. In this paper, we will use the geometric approaches to study the minimality of some linear codes. Based on the geometric approaches (see [13,14,15]) it is easier to construct minimal linear codes or to prove the minimality of some linear codes (see [16,17,18,19,20,21]).

Sunflower in coding theory is a class of important subspace codes and can be used to construct linear codes, see [22]. Let *s* be the number of the elements in a sunflower. In [23], (Theorem 10), the authors proved that if $s≥p+1$, then the corresponding linear code over $\mathbb{F}_p$ is minimal, where *p* is a prime number.

In this paper, we will use the approach used in [14] to consider the minimality of linear codes over $\mathbb{F}_q$ constructed from sunflowers for all *s*. We obtain the following three results: (1) when $s≥q+1$, for any sunflower, the corresponding linear code is minimal; (2) when $2≤s≤3≤q$, for any sunflower, the corresponding linear code is not minimal; (3) when $3<s≤q$, for some sunflowers, the corresponding linear codes are minimal, wherea for some other sunflowers, the corresponding linear codes are not minimal.

This paper is organized as follows. In Section 2, we introduce some basic knowledge about sunflowers, Euclidean inner product, and minimal linear codes. In Section 3, we consider the linear codes constructed from sunflowers and discuss the minimality of these linear codes in three cases. In Section 4, we conclude this paper.

## 2 **Preliminaries**

### 2.1 Sunflower

Throughout this paper, let *k* and $t_0$ be two positive integers, $m=2k+t_0$ and $l=k+t_0$. Let $2≤s≤q^k+1$ be a positive integer, $T_0≤\mathbb{F}_q^m$ be a subspace of $\mathbb{F}_q^m$, and $\mathrm{dim}T_0=t_0$. We denote $\mathcal{G}_q(l,m)$ the set of *l*-dimensional vector subspaces of $\mathbb{F}_q^m$. We define

$$
\mathrm{Φ}=\{E_i≤\mathbb{F}_q^m: \mathrm{dim}E_i=l, E_i∩E_j=T_0, 1≤i≠j≤s\}.
$$

Then, $\mathrm{Φ}⊆\mathcal{G}_q(l,m)$ is a *sunflower* of $\mathbb{F}_q^m$ and the space $T_0$ is called the center of the sunflower $\mathrm{Φ}$.

> **Lemma 1.**
>
> *Let $\mathrm{Φ}⊆\mathcal{G}_q(l,m)$ be a sunflower and $T_0$ the center of Φ. For any $E_i$, $E_j∈\mathrm{Φ}$ with $1≤i≠j≤s,$ we have $\mathbb{F}_q^m=E_i+E_j$.*

> **Proof.**
>
> Since
>
> $$
> \begin{matrix}dim(E_i+E_j) & =dim(E_i)+dim(E_j)−dim(E_i∩E_j) \\ & =dim(E_i)+dim(E_j)−dim(T_0) \\ & =l+l−t_0=m\end{matrix}
> $$
>
> and $E_i+E_j≤\mathbb{F}_q^m$, we have $\mathbb{F}_q^m=E_i+E_j$. □

> **Lemma 2.**
>
> *Let $\mathrm{Φ}⊆\mathcal{G}_q(l,m)$ be a sunflower and $T_0$ the center of Φ. For any $E_i$, $E_j∈\mathrm{Φ}$ with $1≤i≠j≤s,$ we have $E_i^⊥∩E_j^⊥=\{\mathbf{0}\}$.*

> **Proof.**
>
> Assume that $\mathbf{z}∈E_i^⊥∩E_j^⊥$. It follows from Lemma 1 that $\mathbf{z}∈(\mathbb{F}_q^m)^⊥$, which implies $\mathbf{z}=\mathbf{0}$. □

### 2.2 Euclidean Inner Product

Let *m* be a positive integer. For $\mathbf{x}=(x_1,x_2,…,x_m)$, $\mathbf{y}=(y_1,y_2,…,y_m)∈ \mathbb{F}_q^m$, the *Euclidean inner product* of $\mathbf{x}$ and $\mathbf{y}$ is given by

$$
<\mathbf{x},\mathbf{y}>:=\mathbf{x}\mathbf{y}^T=∑_{i=1}^mx_iy_i.
$$

For any $S⊆\mathbb{F}_q^m$, we define

$$
\mathrm{Span}(S):={∑_{i=1}^rλ_i\mathbf{s}_i | r∈\mathbb{N},\mathbf{s}_i∈S,λ_i∈\mathbb{F}_q},
$$

$$
S^⊥:=\{\mathbf{v}∈\mathbb{F}_q^m | \mathbf{vs}^T=0, \mathrm{for} \mathrm{any} \mathbf{s}∈S\}.
$$

Then, Span$(S)$ and $S^⊥$ are vector spaces over $\mathbb{F}_q$ and

$$
\mathrm{dim}(\mathrm{Span}(S))+\mathrm{dim}(S^⊥)=m. \tag{1}
$$

### 2.3 Minimal Linear Codes

All linear codes can be constructed by the following way. Let $m≤n$ be two positive integers. Let $G:=[\mathbf{d}_1,…,\mathbf{d}_n]$ be an $m×n$ matrix over $\mathbb{F}_q$ and $D:=\{\mathbf{d}_1,…,\mathbf{d}_n\}$ be a multiset. Let $r(D)=r(G)$ denote the rank of *G*, which is equal to the dimension of the vector space Span$(D)$ over $\mathbb{F}_q$. Let

$$
\mathcal{C}(D):={\mathbf{c}(\mathbf{x})=\mathbf{x}G=(\mathbf{xd}_1^T,…,\mathbf{xd}_n^T),\mathbf{x}∈\mathbb{F}_q^m}.
$$

Then, $\mathcal{C}(D)$ is an $[n$, $r(D)]_q$ linear code with generator matrix *G*. We always study the minimality of $\mathcal{C}(D)$ by considering some appropriate multisets *D*.

To present the sufficient and necessary condition for minimal linear codes in [14], some concepts are needed. For any $\mathbf{y}∈\mathbb{F}_q^m$, we define

$$
H(\mathbf{y}):=\mathbf{y}^⊥=\{\mathbf{x}∈\mathbb{F}_q^m∣\mathbf{xy}^T=0\},
$$

$$
H(\mathbf{y},D):=D∩H(\mathbf{y})=\{\mathbf{x}∈D∣\mathbf{xy}^T=0\},
$$

$$
V(\mathbf{y},D):=\mathrm{Span}(H(\mathbf{y},D)).
$$

It is obvious that $H(\mathbf{y},D)⊆V(\mathbf{y},D)⊆H(\mathbf{y})$.

> **Proposition 1**
>
> ([14]). *For any $\mathbf{x},\mathbf{y}∈\mathbb{F}_q^m, \mathbf{c}(\mathbf{x})⪯\mathbf{c}(\mathbf{y})$ if and only if $H(\mathbf{y},D)⊆H(\mathbf{x},D)$.*

Let $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$. The following lemma gives a sufficient and necessary condition for the codeword $\mathbf{c}(\mathbf{y})∈\mathcal{C}(D)$ to be minimal.

> **Lemma 3**
>
> ([14] (Theorem 3.1)). *Let $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$. Then, the following three conditions are equivalent:*
>
> - (1) *$\mathbf{c}(\mathbf{y})$ is minimal in $\mathcal{C}(D)$;*
> - (2) *$\mathrm{dim}V(\mathbf{y},D)=m−1$;*
> - (3) *$V(\mathbf{y},D)=H(\mathbf{y})$.*

The following lemma gives a sufficient and necessary condition for linear codes over $\mathbb{F}_q$ to be minimal.

> **Lemma 4**
>
> ([14] (Theorem 3.2)). *The following three conditions are equivalent:*
>
> - (1) *$\mathcal{C}(D)$ is minimal;*
> - (2) *for any $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$, $\mathrm{dim}V(\mathbf{y},D)=m−1$;*
> - (3) *for any $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$, $V(\mathbf{y},D)=H(\mathbf{y})$.*

By the following lemma, we can obtain infinity of many minimal linear codes from any known minimal linear codes.

> **Lemma 5**
>
> ([14] (Proposition 4.1)). *Let $D_1⊆D_2$ be two multisets with elements in $\mathbb{F}_q^m$ and $r(D_1)=r(D_2)=m$. If $\mathcal{C}(D_1)$ is minimal, then $\mathcal{C}(D_2)$ is minimal.*

The following corollary is trivial.

> **Corollary 1.**
>
> *Let $D_1⊆D_2$ be two multisets with elements in $\mathbb{F}_q^m$ and $r(D_1)=r(D_2)=m$. If $\mathcal{C}(D_2)$ is not minimal, then $\mathcal{C}(D_1)$ is not minimal.*

In the following section, we will use the above lemmas to consider the minimality of linear codes constructed from sunflowers.

## 3 The Minimality of Linear Codes Constructed from Sunflowers

In this section, we consider the linear codes constructed from sunflowers and discuss the minimality of these linear codes.

Let

$$
\mathrm{Φ}=\{E_i≤\mathbb{F}_q^m: \mathrm{dim}E_i=l,E_i∩E_j=T_0,1≤i≠j≤s\}.
$$

be a sunflower of $\mathbb{F}_q^m$ and $T_0$ the center of $\mathrm{Φ}$.

Let

$$
D:=(⋃_{i=1}^sE_i)∖T_0=⋃_{i=1}^s(E_i∖T_0). \tag{2}
$$

It is easy to see that $\mathcal{C}(D)$ is a $[s(q^l−q^{t_0}),m]_q$ linear code.

The following lemmas are important in the proofs of this section.

> **Lemma 6**
>
> ([24] (Lemma 3.1)). *For all $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$, $E≤\mathbb{F}_q^m$ and dim$(E)=r$, we have $H(\mathbf{y},E)=V(\mathbf{y},E)$ and*
>
> $$
> \mathrm{dim}V(\mathbf{y},E)={\begin{matrix} & r, & if \mathbf{y}∈E^⊥; \\ & r−1, & if \mathbf{y}∉E^⊥.\end{matrix}
> $$

By linear algebra, we can obtain the following lemma.

> **Lemma 7.**
>
> *Let $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$. If for any $E_i∈\mathrm{Φ}$, $\mathbf{y}∉E_i^⊥$, $1≤i≤s$. For any $E_{i_0}$, $E_{j_0}∈\mathrm{Φ}$, $E_{i_0}≠E_{j_0}$, let $D_1=(E_{i_0}∪E_{j_0})∖T_0$. We have*
>
> $$
> \mathrm{rank}H(\mathbf{y},D_1)={\begin{matrix} & m−2, & if \mathbf{y}∈T_0^⊥; \\ & m−1, & if \mathbf{y}∉T_0^⊥.\end{matrix}
> $$

> **Proof.**
>
> Since $\mathbf{y}∉E_i^⊥$, it follows from Lemma 6 that $\mathrm{dim}H(\mathbf{y},E_{i_0})=\mathrm{dim}H(\mathbf{y},E_{j_0})=l−1$. Note that $H(\mathbf{y},T_0)≤H(\mathbf{y},E_{i_0})$ and $H(\mathbf{y},T_0)≤H(\mathbf{y},E_{j_0}).$
>
> If $\mathbf{y}∈T_0^⊥$, then $H(\mathbf{y},T_0)=T_0$. Suppose that
>
> $$
> \begin{matrix}H(\mathbf{y},T_0)=T_0=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\}, \\ H(\mathbf{y},E_{i_0})=\mathrm{Span}\{α_1,α_2,…,α_{k−1},γ_1,γ_2,…,γ_{t_0}\}, \\ H(\mathbf{y},E_{j_0})=\mathrm{Span}\{β_1,β_2,…,β_{k−1},γ_1,γ_2,…,γ_{t_0}\}.\end{matrix}
> $$
>
> Then, we have
>
> $$
> \begin{matrix} & H(\mathbf{y},E_{i_0})∖T_0⊇\{α_1,α_2…,α_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}, \\ & H(\mathbf{y},E_{j_0})∖T_0⊇\{β_1,β_2,…,β_{k−1},β_1+γ_1,β_1+γ_2,…,β_1+γ_{t_0}\}.\end{matrix}
> $$
>
> Since $H(\mathbf{y},D_1)=(H(\mathbf{y},E_{i_0})∪H(\mathbf{y},E_{j_0}))∖T_0$, the above equations lead to
>
> $$
> H(\mathbf{y},D_1)⊇\{α_1,α_2,…,α_{k−1},β_1,β_2,…,β_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\},
> $$
>
> i.e., $\mathrm{rank}H(\mathbf{y},D_1)=m−2$.
>
> If $\mathbf{y}∉T_0^⊥$, then $\mathrm{dim}H(\mathbf{y},T_0)=t_0−1$ by Lemma 6. Suppose that
>
> $$
> \begin{matrix}H(\mathbf{y},T_0)=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0−1}\}, \\ T_0=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0−1},γ_{t_0}\}, \\ H(\mathbf{y},E_{i_0})=\mathrm{Span}\{α_1,α_2,…,α_k,γ_1,γ_2,…,γ_{t_0−1}\}, \\ H(\mathbf{y},E_{j_0})=\mathrm{Span}\{β_1,β_2,…,β_k,γ_1,γ_2,…,γ_{t_0−1}\}.\end{matrix}
> $$
>
> Then, we have
>
> $$
> \begin{matrix} & H(\mathbf{y},E_{i_0})∖T_0⊇\{α_1,α_2…,α_k,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0−1}\}, \\ & H(\mathbf{y},E_{j_0})∖T_0⊇\{β_1,β_2,…,β_k,β_1+γ_1,β_1+γ_2,…,β_1+γ_{t_0−1}\}.\end{matrix}
> $$
>
> Since $H(\mathbf{y},D_1)=(H(\mathbf{y},E_{i_0})∪H(\mathbf{y},E_{j_0}))∖T_0$, the above equations yield
>
> $$
> H(\mathbf{y},D_1)⊇\{α_1,α_2,…,α_k,β_1,β_2,…,β_k,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0−1}\},
> $$
>
> i.e., $\mathrm{rank}H(\mathbf{y},D_1)=m−1$. The proof is completed. □

Now, we consider the minimality of $\mathcal{C}(D)$ in three cases. First, when $s≥q+1$, we have

> **Theorem 1.**
>
> *Let $\mathrm{Φ}=\{E_1,…,E_s\}$ be a sunflower of $\mathbb{F}_q^m$ with center $T_0$ of dimension $t_0$. If $s≥q+1$, then $\mathcal{C}(D)$ is an $[s(q^l−q^{t_0}),m]_q$ minimal linear code.*

> **Proof.**
>
> According to Lemma 4, we only need to prove that for any $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$, $\mathrm{dim}V(\mathbf{y},D)=m−1$. By (2), we obtain
>
> $$
> H(\mathbf{y},D)=D∩H(\mathbf{y})=⋃_{i=1}^s(H(\mathbf{y},E_i)∖T_0). \tag{3}
> $$
>
> There are three cases:
>
> (1) If there exists $E_{i_0}∈\mathrm{Φ}$ such that $\mathbf{y}∈E_{i_0}^⊥$, then we have $\mathrm{dim}H(\mathbf{y},E_{i_0})=l$ from Lemma 6. According to Lemma 2, for any $E_{j_0}∈\mathrm{Φ}$ with $E_{j_0}≠E_{i_0}$, we have $\mathbf{y}∉E_{j_0}^⊥.$ Then, it follows from Lemma 6 that $\mathrm{dim}H(\mathbf{y},E_{j_0})=l−1.$ Since $\mathbf{y}∈E_{i_0}^⊥⊆T_0^⊥$, we have $H(\mathbf{y},T_0)=T_0$. We set
>
> $$
> H(\mathbf{y},T_0)=T_0=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> When $k=1$, we set
>
> $$
> H(\mathbf{y},E_{i_0})=\mathrm{Span}\{α_1,γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> By (3), we have $H(\mathbf{y},D)⊇\{α_1,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}$, and so $\mathrm{dim}V(\mathbf{y},D)=m−1$.
>
> When $k>1$, we set
>
> $$
> H(\mathbf{y},E_{i_0})=\mathrm{Span}\{α_1,α_2,…,α_k,γ_1,γ_2,…,γ_{t_0}\},
> $$
>
> and
>
> $$
> H(\mathbf{y},E_{j_0})=\mathrm{Span}\{β_1,β_2,…,β_{k−1},γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> By (3), we have
>
> $$
> H(\mathbf{y},D)⊇\{α_1,α_2,…,α_k,β_1,β_2,…,β_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}.
> $$
>
> Since
>
> $$
> \mathrm{rank}\{α_1,α_2,…,α_k,β_1,β_2,…,β_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}=m−1,
> $$
>
> it is easy to obtain $\mathrm{dim}V(\mathbf{y},D)=m−1$.
>
> (2) If for any $E_i∈\mathrm{Φ}$, $1≤i≤s$, we have $\mathbf{y}∉E_i^⊥$ and $\mathbf{y}∉T_0^⊥$, then $\mathrm{dim}H(\mathbf{y},E_{i_0})=$ dim$H(\mathbf{y},E_{j_0})=l−1$ for any $E_{i_0},E_{j_0}∈\mathrm{Φ}$ with $E_{i_0}≠E_{j_0}$. Since $\mathbf{y}∉T_0^⊥$, $\mathrm{dim}H(\mathbf{y},T_0)=t_0−1.$ We set
>
> $$
> H(\mathbf{y},T_0)=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0−1}\}, T_0=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> When $k=1$, we set
>
> $$
> H(\mathbf{y},E_{i_0})=\mathrm{Span}\{α_1,γ_1,γ_2,…,γ_{t_0−1}\}, H(\mathbf{y},E_{j_0})=\mathrm{Span}\{β_1,γ_1,γ_2,…,γ_{t_0−1}\}.
> $$
>
> Then,
>
> $$
> H(\mathbf{y},D)⊇\{α_1,β_1,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0−1}\}.
> $$
>
> Since
>
> $$
> \mathrm{rank}\{α_1,β_1,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0−1}\}=m−1,
> $$
>
> it is easy to obtain $\mathrm{dim}V(\mathbf{y},D)=m−1$.
>
> When $k>1$, let $D_1=(E_{i_0}∪E_{j_0})∖T_0$. By Lemma 7, we have rank$(H(\mathbf{y},D_1))=m−1,$ thus $\mathrm{dim}V(\mathbf{y},D)=m−1.$
>
> (3) If for any $E_i∈\mathrm{Φ}$, $1≤i≤s$, we have $\mathbf{y}∉E_i^⊥$ and $\mathbf{y}∈T_0^⊥$; then, it follows from Lemma 6 that $\mathrm{dim}H(\mathbf{y},E_i)=l−1$ and $\mathrm{dim}H(\mathbf{y},T_0)=t_0.$
>
> When $k=1$, we obtain $\mathrm{dim}T_0^⊥$=2 and $\mathrm{dim}E_i^⊥$=1, $1≤i≤s$, then $E_i^⊥$ is the one-dimensional subspace of $T_0^⊥$. There are $q+1$ one dimensional subspace of $T_0^⊥$, since $s≥q+1$, we obtain $s=q+1$. By Lemma 2, for any $E_i$, $E_j∈\mathrm{Φ}$, $E_i≠E_j$, we have $E_i^⊥∩E_j^⊥=\{0\}$. Thus,
>
> $$
> T_0^⊥=⋃_{i=1}^sE_i^⊥. \tag{4}
> $$
>
> Since $\mathbf{y}∈T_0^⊥$, by (4), there exists $E_j∈\mathrm{Φ},$ such that $\mathbf{y}∈E_j^⊥,$ a contradiction. So $k≠1$.
>
> When $k>1$, we have $\mathrm{dim}H(\mathbf{y},E_1)$=dim$H(\mathbf{y},E_2)=l−1.$ Let $D_1=(E_1∪E_2)∖T_0$. By Lemma 7, we have rank$(H(\mathbf{y},D_1))=m−2.$ We set
>
> $$
> T_0=H(\mathbf{y},T_0)=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> $$
> E_1=\mathrm{Span}\{α_1,α_2,…,α_{k−1},α_k,γ_1,γ_2,…,γ_{t_0}\}, H(\mathbf{y},E_1)=\mathrm{Span}\{α_1,α_2,…,α_{k−1},γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> $$
> E_2=\mathrm{Span}\{β_1,β_2,…,β_{k−1},β_k,γ_1,γ_2,…,γ_{t_0}\}, H(\mathbf{y},E_2)=\mathrm{Span}\{β_1,β_2,…,β_{k−1},γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> Let
>
> $$
> B=\{α_1,α_2,…,α_{k−1},β_1,β_2,…,β_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}.
> $$
>
> Then, rank$B=m−2$ and $B⊆H(\mathbf{y},D)$. Let $V=\mathbb{F}_q^m$, $W=\mathrm{Span}(\mathrm{B})$ and $\bar{V}=V/W$ the quotient space of *V* over *W*. We have $\mathrm{dim}\bar{V}=2$ and $V=$Span$\{\bar{α_k},\bar{β_k}\}$. Let $π$ be the standard map from *V* to $\bar{V}$. For any $E_i∈\mathrm{Φ}$, $1≤i≤s$, $π(E_i)$ is a subspace of $\bar{V}$. It is easily seen that $\mathrm{dim}π(E_i)=1$ or 2. There are the following two cases.
>
> (i) If there exists $E_{i_0}∈\mathrm{Φ}$ such that $\mathrm{dim}π(E_{i_0})=2$, then $π(E_{i_0})=\bar{V}$. There must exist $α∈E_{i_0}$ such that
>
> $$
> π(α)=\bar{α_k−bβ_k}, \mathrm{where} b=(α_k\mathbf{y}^T)/(β_k\mathbf{y}^T).
> $$
>
> So, $α=α_k−bβ_k+\mathbf{w}$, where $\mathbf{w}∈W$. It is simply checked that $α∉T_0$, $α∈H(\mathbf{y})$ and $α∉W$. We obtain
>
> $$
> (B∪\{α\})⊆H(\mathbf{y},D), \mathrm{rank}(B∪\{α\})=m−1.
> $$
>
> Thus, $\mathrm{dim}V(\mathbf{y},D)=m−1$.
>
> (ii) If for any $E_i∈\mathrm{Φ}$ we have $\mathrm{dim}π(E_i)=1$, combining that $V=E_i+E_j$ for any $E_i$, $E_j∈\mathrm{Φ}$ with $E_i≠E_j$ in accordance with Lemma 1, we have
>
> $$
> \bar{V}=π(V)=π(E_i)+π(E_j) \mathrm{and} π(E_i)≠π(E_j).
> $$
>
> Since $\bar{V}$ has only $q+1$ one-dimensional subspace and $s≥q+1$, we have $s=q+1$ and $\bar{V}=⋃_{i=1}^sπ(E_i)$. There must exist $E_{j_0}∈\mathrm{Φ}$ such that
>
> $$
> π(E_{j_0})=\mathrm{Span}\{\bar{α_k−bβ_k}\}, \mathrm{where} b=(α_k\mathbf{y}^T)/(β_k\mathbf{y}^T).
> $$
>
> Hence, there exists $α=α_k−bβ_k+\mathbf{w}∈E_{j_0}$, where $\mathbf{w}∈W$, such that $π(α)=\bar{α_k−bβ_k}$. One can easily deduce that $α∉T_0$, $α∈H(\mathbf{y})$ and $α∉W$. We obtain
>
> $$
> (B∪\{α\})⊆H(\mathbf{y},D), \mathrm{rank}(B∪\{α\})=m−1.
> $$
>
> Thus, $\mathrm{dim}V((y),D)=m−1$.
>
> In conclusion, for any $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\},$ we have $\mathrm{dim}V(\mathbf{y},D)=m−1$, so $\mathcal{C}(D)$ is a minimal linear code. □

> **Remark 1.**
>
> *In Theorem 1, if $q=p$ is a prime number, then it becomes [23] (Theorem 10). So Theorem 1 is a generalization of [23] (Theorem 10). Our method is different from theirs. When $s≤q$, our method also can be used to study the minimality of the linear codes, whereas theirs can not.*

> **Example 1.**
>
> *Let $\mathbf{e}_1,…,\mathbf{e}_m$ be the standard basis of $\mathbb{F}_q^m$. Let*
>
> $$
> T_0^′=\mathrm{Span}(\{\mathbf{e}_{2k+1},\mathbf{e}_{2k+2},…,\mathbf{e}_m\})=\{(\mathbf{0},\mathbf{0},\mathbf{t})|\mathbf{t}∈\mathbb{F}_q^{t_0}\}. \tag{5}
> $$
>
> *For any $b∈\mathbb{F}_q$, we define*
>
> $$
> E_b=\mathrm{Span}\{\mathbf{e}_1+b\mathbf{e}_{k+1},\mathbf{e}_2+b\mathbf{e}_{k+2},…,\mathbf{e}_k+b\mathbf{e}_{2k},\mathbf{e}_{2k+1},…,\mathbf{e}_m\}. \tag{6}
> $$
>
> *Suppose that*
>
> $$
> \mathrm{Φ}=\{E_b|b∈\mathbb{F}_q\}∪\mathrm{Span}\{\mathbf{e}_{k+1},\mathbf{e}_{k+2},…,\mathbf{e}_{2k},\mathbf{e}_{2k+1},…,\mathbf{e}_m\}
> $$
>
> *and*
>
> $$
> D^′=\underset{E_i∈\mathrm{Φ}}{⋃}(E_i∖T_0^′).
> $$
>
> *It is easy to see that Φ is a sunflower of $\mathbb{F}_q^m$ with center $T_0^′$ and $s=q+1$. Here, we take $q=4,k=3$, and $t_0=1$. With the help of Magma, we verify that the code $\mathcal{C}(D^′)$ is a minimal $[1260,7]_4$ linear code with minimum distance 768, and*
>
> $$
> \frac{w_{\mathrm{min}}}{w_{\mathrm{max}}}=\frac{4}{5}>\frac{3}{4}.
> $$

Now, we consider the minimality of $\mathcal{C}(D)$ when $2≤s≤3≤q$. If $s=3$, we have

> **Theorem 2.**
>
> *Let $\mathrm{Φ}=\{E_1,…,E_s\}$ be a sunflower of $\mathbb{F}_q^m$ with center $T_0$ of dimension $t_0$. If $s=3≤q$, then $\mathcal{C}(D)$ is not minimal.*

> **Proof.**
>
> To prove $\mathcal{C}(D)$ is not minimal, by Lemma 4, we only need to prove there exists $\mathbf{y}_0∈\mathbb{F}_q^m∖\{\mathbf{0}\}$ such that $\mathrm{dim}V(\mathbf{y}_0,D)≤m−2.$
>
> When $s=3$, $\mathrm{Φ}=\{E_1,E_2,E_3\}$. By Lemma 2 we know $E_1^⊥∩E_2^⊥=\{\mathbf{0}\}$. Then, for any $\mathbf{y}_1∈E_2^⊥∖\{\mathbf{0}\}$, we have $\mathbf{y}_1∉E_1^⊥$ and $\mathbf{y}_1∈T_0^⊥$. Thus, $\mathrm{dim}H(\mathbf{y}_1,E_1)=l−1$, $\mathrm{dim}H(\mathbf{y}_1,E_2)=l$, and $\mathrm{dim}H(\mathbf{y}_1,T_0)=t_0$. We set
>
> $$
> T_0=H(\mathbf{y}_1,T_0)=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\},
> $$
>
> $$
> E_1=\mathrm{Span}\{α_1,α_2,…,α_{k−1},α_k,γ_1,γ_2,…,γ_{t_0}\}, H(\mathbf{y}_1,E_1)=\mathrm{Span}\{α_1,α_2,…,α_{k−1},γ_1,γ_2,…,γ_{t_0}\},
> $$
>
> $$
> E_2=H(\mathbf{y}_1,E_2)=\mathrm{Span}\{β_1,β_2,…,β_k,γ_1,γ_2,…,γ_{t_0}\},
> $$
>
> where $α_k\mathbf{y}_1^T=1$. Let
>
> $$
> E_1^′=\mathrm{Span}\{α_1,α_2,…,α_k\}, E_2^′=\mathrm{Span}\{β_1,β_2,…,β_k\},
> $$
>
> we have $\mathbb{F}_q^m=E_1^′⊕E_2^′⊕T_0.$ For any $η∈E_3,$ there exist unique $α∈E_1^′$, $β∈E_2^′,γ∈T_0$, such that $η=α+β+γ.$ Since $α+β=η−γ∈E_3$, for any $α∈E_1^′$, there exists unique $β∈E_2^′$ such that $α+β∈E_3$. Let $φ$ be a map from $E_1^′$ to $E_2^′$ satisfying $φ(α)=β$. We can see $φ$ is an isomorphism from $E_1^′$ to $E_2^′$ and
>
> $$
> E_3=\{\mathbf{x}+φ(\mathbf{x})|\mathbf{x}∈E_1^′\}⊕T_0=E_3^′⊕T_0.
> $$
>
> Since $\mathbf{y}_1∉E_1^⊥$, $\mathbf{y}_1∈T_0^⊥$, and $E_1=E_1^′⊕T_0$, we have $\mathbf{y}_1∉(E_1^′)^⊥$, $\mathrm{dim}H(\mathbf{y}_1,E_1^′)=k−1,\mathrm{dim}φ(H(\mathbf{y}_1,E_1^′))=k−1$, and $\mathrm{dim}φ(H(\mathbf{y}_1,E_1^′))^⊥=m−(k−1)=k+t_0+1.$ Thus,
>
> $$
> \begin{matrix} & \mathrm{dim}(φ(H(\mathbf{y}_1,E_1^′))^⊥∩E_1^⊥) \\ = & \mathrm{dim}φ(H(\mathbf{y}_1,E_1^′))^⊥+\mathrm{dim}(E_1^⊥)−\mathrm{dim}(φ(H(\mathbf{y}_1,E_1^′))^⊥+E_1^⊥) \\ ≥ & k+t_0+1+k−m=1.\end{matrix}
> $$
>
> Since $q≥3$, there exists $\mathbf{y}_2∈(φ(H(\mathbf{y}_1,E_1^′))^⊥∩E_1^⊥)∖\{\mathbf{0}\}$ such that $φ(α_k)\mathbf{y}_2^T≠−1$. It is easy to see $\mathbf{y}_2∉E_2^⊥$ and $\mathbf{y}_2∈T_0^⊥.$ Let $\mathbf{y}_0=\mathbf{y}_1+\mathbf{y}_2$, we obtain $\mathbf{y}_0∉E_1^⊥$, $\mathbf{y}_0∉E_2^⊥$, and $\mathbf{y}_0∈T_0^⊥$. Since $α_k+φ(α_k)∈E_3$ and
>
> $$
> \begin{matrix}(α_k+φ(α_k))\mathbf{y}_0^T & =(α_k+φ(α_k))(\mathbf{y}_1+\mathbf{y}_2)^T \\ & =α_k\mathbf{y}_1^T+α_k\mathbf{y}_2^T+φ(α_k)\mathbf{y}_1^T+φ(α_k)\mathbf{y}_2^T \\ & =1+0+0+φ(α_k)\mathbf{y}_2^T≠0,\end{matrix}
> $$
>
> we obtain $\mathbf{y}_0∉E_3^⊥.$ Thus, $\mathbf{y}_0∉E_i^⊥, 1≤i≤3$ and $\mathrm{dim}H(\mathbf{y}_0,E_i)=l−1.$
>
> (1) When $k=1$, $\mathrm{dim}H(\mathbf{y}_0,E_i)=t_0$, since $T_0≤H(\mathbf{y}_0,E_i)$, we have $T_0=H(\mathbf{y}_0,E_i)$. Thus,
>
> $$
> H(\mathbf{y}_0,D)=⋃_{i=1}^3(H(\mathbf{y},E_i)∖T_0)=∅.
> $$
>
> Thus, $\mathcal{C}(D)$ is not minimal.
>
> (2) When $k>1$, since $E_i=E_i^′⊕T_0$, we have $\mathbf{y}_0∉(E_i^′)^⊥$ and $\mathrm{dim}H(\mathbf{y}_0,E_i^′)=k−1.$ Thus,
>
> $$
> H(\mathbf{y}_0,E_i)=H(\mathbf{y}_0,E_i^′)⊕T_0, 1≤i≤3.
> $$
>
> By Lemma 6, it is easily verified that
>
> $$
> H(\mathbf{y}_0,E_1^′)=H(\mathbf{y}_1,E_1^′),
> $$
>
> $$
> H(\mathbf{y}_0,E_2^′)=H(\mathbf{y}_2,E_2^′)=φ(H(\mathbf{y}_1,E_1^′))=φ(H(\mathbf{y}_0,E_1^′)),
> $$
>
> $$
> H(\mathbf{y}_0,E_3^′)=\{\mathbf{x}+φ(\mathbf{x})|\mathbf{x}∈H(\mathbf{y}_0,E_1^′)\}⊆\mathrm{Span}(H(\mathbf{y}_0,E_1^′)∪H(\mathbf{y}_0,E_2^′)).
> $$
>
> Then, $\mathrm{dim}V(\mathbf{y}_0,D)=m−2$. By Lemma 4, we have that $c(\mathbf{y}_0)$ is not minimal. □

Combining Theorem 2 and Corollary 1, we have

> **Corollary 2.**
>
> *Let $\mathrm{Φ}=\{E_1,…,E_s\}$ be a partial spread of $\mathbb{F}_q^m$. If $2≤s≤3≤q$, then $\mathcal{C}(D)$ is not minimal.*

Now, we consider the minimality of $\mathcal{C}(D)$ when $4≤s≤q$. We recall from (5) that

$$
T_0^′=\mathrm{Span}(\{\mathbf{e}_{2k+1},\mathbf{e}_{2k+2},…,\mathbf{e}_m\})=\{(\mathbf{0},\mathbf{0},\mathbf{t})|\mathbf{t}∈\mathbb{F}_q^{t_0}\}.
$$

We will show that some sunflowers $\mathrm{Φ}$ with center $T_0^′$, $\mathcal{C}(D)$ are minimal, whereas some other sunflowers $\mathrm{Φ}$ with center $T_0^′$, $\mathcal{C}(D)$ are not minimal.

First, we construct some sunflowers $\mathrm{Φ}$ such that $\mathcal{C}(D)$ are minimal. Let $k≥2$, $f(x)$ be an irreducible polynomial in $\mathbb{F}_q[x]$ of degree *k* and $M∈\mathbb{F}_q^{k×k}$ be a matrix with characteristic polynomial $f(x)$. We define

$$
\begin{matrix} & E_1=\{(\mathbf{x},\mathbf{0},\mathbf{t})|\mathbf{x}∈\mathbb{F}_q^k,\mathbf{t}∈\mathbb{F}_q^{t_0}\},E_2=\{(\mathbf{0},\mathbf{x},\mathbf{t})|\mathbf{x}∈\mathbb{F}_q^k,\mathbf{t}∈\mathbb{F}_q^{t_0}\}, \\ & E_3=\{(\mathbf{x},\mathbf{x},\mathbf{t})|\mathbf{x}∈\mathbb{F}_q^k,\mathbf{t}∈\mathbb{F}_q^{t_0}\},E_4=\{(\mathbf{x},\mathbf{x}M,\mathbf{t})|\mathbf{x}∈\mathbb{F}_q^k,\mathbf{t}∈\mathbb{F}_q^{t_0}\},\end{matrix} \tag{7}
$$

and

$$
\mathrm{Φ}=\{E_1,E_2,E_3,E_4\}. \tag{8}
$$

We can see $\mathrm{Φ}$ is a sunflower with center $T_0^′$.

> **Theorem 3.**
>
> *For the sunflower *Φ* defined in (8), the linear code $\mathcal{C}(D)$ is minimal.*

> **Proof.**
>
> According to Lemma 4, we only need to prove that for any $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$, $\mathrm{dim}V(\mathbf{y},D)=m−1$. There are three cases:

- (1) If there exists $E_{i_0}∈\mathrm{Φ}$ such that $\mathbf{y}∈E_{i_0}^⊥$, the proof is similar as that in Theorem 1 (1).
- (2) If for any $E_i∈\mathrm{Φ}$, $1≤i≤s$, we have $\mathbf{y}∉E_i^⊥$ and $\mathbf{y}∉T_0^{′⊥}$, then the proof is similar to that in Theorem 1 (2).
- (3) If for any $E_i∈\mathrm{Φ}$, $1≤i≤s$, we have $\mathbf{y}∉E_i^⊥$ and $\mathbf{y}∈T_0^{′⊥}$, the proof is as follows. Let $\mathbf{y}=(\mathbf{y}_1,\mathbf{y}_2,\mathbf{y}_3)$ where $\mathbf{y}_1,\mathbf{y}_2∈\mathbb{F}_q^k,\mathbf{y}_3∈\mathbb{F}_q^{t_0}$. Next, we define two linear transformations $φ$, $ψ$ from $\mathbb{F}_q^k$ to $\mathbb{F}_q^k$:

  $$
  φ(\mathbf{x})=\mathbf{x},ψ(\mathbf{x})=\mathbf{x}M,\mathbf{x}∈\mathbb{F}_q^k. \tag{9}
  $$

  Then,

  $$
  \begin{matrix} & E_3=\{(\mathbf{x},φ(\mathbf{x}),\mathbf{t})|\mathbf{x}∈\mathbb{F}_q^k,\mathbf{t}∈\mathbb{F}_q^{t_0}\},E_4=\{(\mathbf{x},φ(\mathbf{x}),\mathbf{t})|\mathbf{x}∈\mathbb{F}_q^k,\mathbf{t}∈\mathbb{F}_q^{t_0}\}.\end{matrix} \tag{10}
  $$

  Let

  $$
  \begin{matrix} & E_1^′=\{(\mathbf{x},\mathbf{0},\mathbf{0})|\mathbf{x}∈\mathbb{F}_q^k\},E_2^′=\{(\mathbf{0},\mathbf{x},\mathbf{0})|\mathbf{x}∈\mathbb{F}_q^k\}, \\ & E_3^′=\{(\mathbf{x},φ(\mathbf{x}),\mathbf{0})|\mathbf{x}∈\mathbb{F}_q^k\},E_4^′=\{(\mathbf{x},ψ(\mathbf{x}),\mathbf{0})|\mathbf{x}∈\mathbb{F}_q^k\}.\end{matrix} \tag{11}
  $$

  It is easy to verify that

  $$
  E_i=E_i^′⊕T_0^′, 1≤i≤4.
  $$

  Let

  $$
  \begin{matrix}S: & =\mathrm{Span}\{H(\mathbf{y},E_1)∪H(\mathbf{y},E_2)\} \\ & =\mathrm{Span}\{\{H(\mathbf{y},E_1)∪H(\mathbf{y},E_2)\}∖T_0^′\} \\ & =\{(α,β,\mathbf{0})|α∈H(\mathbf{y},E_1),β∈H(\mathbf{y},E_2)\}⊕\{(\mathbf{0},\mathbf{0},\mathbf{t})|\mathbf{t}∈\mathbb{F}_q^{t_0}\} \\ & =S^′⊕T_0^′.\end{matrix} \tag{12}
  $$

  By Lemma 7, we have dim.

Now, we prove $H(\mathbf{y},E_3)⊈S$ or $H(\mathbf{y},E_4)⊈S.$ If not, assume that $H(\mathbf{y},E_3)⊆S$ and $H(\mathbf{y},E_4)⊆S$. By $H(\mathbf{y},E_3)⊆S$, it is obvious that $H(\mathbf{y},E_3^′)⊆S^′$. Since $\mathbf{y}∉E_3^⊥$ and $\mathbf{y}∈T_0^{′⊥}$, we have $\mathbf{y}∉E_3^{′⊥}$, and then $\mathrm{dim}H(\mathbf{y},E_3^′)=k−1.$ There exists $α_1,…,α_{k−1}∈H(\mathbf{y}_1)$, $β_1,…,β_{k−1}∈H(\mathbf{y}_2)$ such that $(α_1,β_1,\mathbf{0}),…,(α_{k−1},β_{k−1},\mathbf{0})$ is a basis of $H(\mathbf{y},E_3^′)$. Then, (10) yields $β_i=φ(α_i)$. It is effortlessly demonstrated that $α_1,…,α_{k−1}$ is a basis of $H(\mathbf{y}_{\mathbf{1}})$, and $β_1,…,β_{k−1}$ is a basis of $H(\mathbf{y}_{\mathbf{2}})$. Thus,

$$
φ(H(\mathbf{y}_1))=H(\mathbf{y}_2).
$$

Similarly, by $H(\mathbf{y},E_4)⊆S$, we obtain

$$
ψ(H(\mathbf{y}_1))=H(\mathbf{y}_2).
$$

Then, we have

$$
ψ(H(\mathbf{y}_1))=H(\mathbf{y}_2)=φ(H(\mathbf{y}_1))=H(\mathbf{y}_1).
$$

That is to say, $H(\mathbf{y}_1)$ is the $ψ$-$\mathrm{invariant} \mathrm{subspace}$ of $\mathbb{F}_q^k$.

Let $α_1,…,α_{k−1},α_k$ be a basis of $\mathbb{F}_q^k$, where $α_1,…,α_{k−1}$ is a basis of $H(\mathbf{y}_1)$. Then, the matrix of $ψ$ with respect to this basis is

$$
B=(\begin{matrix}B_1 & B_2 \\ \mathbf{0} & b\end{matrix}),
$$

where $B_1$ is the matrix of $ψ|H(\mathbf{y}_1)$ with respect to $α_1,…,α_{k−1}$. Note that *M* is the matrix of $ψ$ with respect to the standard basis, and thus *M* and *B* are similar and have the same characteristic polynomial. So

$$
f(x)=|xI−B_1|(x−b),
$$

a contradiction with the irreducibility of $f(x)$. Hence, $H(\mathbf{y},E_3)⊈S$ or $H(\mathbf{y},E_4)⊈S$. It is easy to see that $r(\{H(\mathbf{y},E_1)∪H(\mathbf{y},E_2)∪H(\mathbf{y},E_3)\}∖T_0^′)=m−1$ or $r(\{H(\mathbf{y},E_1)∪H(\mathbf{y},E_2)∪H(\mathbf{y},E_4)\}∖T_0^′)=m−1$. So, $\mathrm{dim}V(\mathbf{y},D)=m−1$.

In conclusion, for any $\mathbf{y}∈\mathbb{F}_q^m∖\{\mathbf{0}\}$, $\mathrm{dim}V(\mathbf{y},D)=m−1$. By Lemma 4, $\mathcal{C}(D)$ is minimal. □

Combining Theorem 3 and Lemma 5, we have

> **Corollary 3.**
>
> *Let $s≥4$ and $\mathrm{Φ}=\{E_1,…,E_s\}$ be a sunflower of $\mathbb{F}_q^m$ with center $T_0^′$. If $\{E_1,E_2,E_3,E_4\}$ are defined as (7), then $\mathcal{C}(D)$ is minimal.*

> **Example 2.**
>
> *Take $q=5,k=2$, and $t_0=1$. Let $f(x)=x^2+x+1$ and*
>
> $$
> M=(\begin{matrix}0 & −1 \\ 1 & −1\end{matrix}).
> $$
>
> *It is easily checked that $f(x)∈\mathbb{F}_q[x]$ is an irreducible polynomial of degree 2 and the characteristic polynomial of M. Then, the code $\mathcal{C}(D)$ constructed based on Theorem 3 is a minimal $[480,5]_5$ linear code with minimum distance 300, and*
>
> $$
> \frac{w_{\mathrm{min}}}{w_{\mathrm{max}}}=\frac{3}{4}<\frac{4}{5}.
> $$

Now, we construct some sunflowers $\mathrm{Φ}$ with center $T_0^′$ such that $\mathcal{C}(D)$ are not minimal. Let us recall from (6) that

$$
E_b=\mathrm{Span}\{\mathbf{e}_1+b\mathbf{e}_{k+1},\mathbf{e}_2+b\mathbf{e}_{k+2},…,\mathbf{e}_k+b\mathbf{e}_{2k},\mathbf{e}_{2k+1},…,\mathbf{e}_m\}.
$$

Let

$$
\mathrm{Φ}=\{E_b|b∈\mathbb{F}_q\}. \tag{13}
$$

It is easy to see that $\mathrm{Φ}$ is a sunflower of $\mathbb{F}_q^m$ with center $T_0^′$.

> **Theorem 4.**
>
> *For the sunflower Φ defined in (13), the linear code $\mathcal{C}(D)$ is not minimal.*

> **Proof.**
>
> Let $\mathbf{y}_0=\mathbf{e}_1$. Then, for any $b∈\mathbb{F}_q$, we obtain
>
> $$
> \begin{matrix}H(\mathbf{y}_0,E_b) & =\mathrm{Span}\{\mathbf{e}_2+b\mathbf{e}_{k+2},…,\mathbf{e}_k+b\mathbf{e}_{2k},\mathbf{e}_{2k+1},…,\mathbf{e}_m\} \\ & ⊆\mathrm{Span}\{\mathbf{e}_2,…,\mathbf{e}_k,\mathbf{e}_{k+2},…,\mathbf{e}_{2k},\mathbf{e}_{2k+1},…,\mathbf{e}_m\}.\end{matrix}
> $$
>
> By (3), we have
>
> $$
> H(\mathbf{y}_0,D)⊆\mathrm{Span}(\{\mathbf{e}_2,…,\mathbf{e}_k,\mathbf{e}_{k+2},…,\mathbf{e}_{2k},\mathbf{e}_{2k+1},…,\mathbf{e}_m\}).
> $$
>
> Then, $\mathrm{dim}V(\mathbf{y}_0,D)≤m−2$. By Lemma 4, we have that $\mathbf{c}(\mathbf{y}_0)$ is not minimal and $\mathcal{C}(D)$ is not minimal. □

Combining Theorem 4 and Corollary 1, we have

> **Corollary 4.**
>
> *Let $3<s≤q$ and $S⊆\mathbb{F}_q$ where $#S=s$. Let $\mathrm{Φ}=\{E_b| b∈S\}$. Then, $\mathcal{C}(D)$ is not minimal.*

> **Remark 2.**
>
> *In Theorem 3, Corollary 3, Theorem 4, and Corollary 4, the center of the sunflower Φ is the special subspace $T_0^′$. When the center is a general subspace, we have not yet proved the minimality of $\mathcal{C}(D)$.*

> **Example 3.**
>
> *Take $q=3,k=2$, and $t_0=2$. Then, the code $\mathcal{C}(D)$ constructed based on Theorem 4 is $[216,6]_3$ linear code with minimum distance 108, and*
>
> $$
> \frac{w_{\mathrm{min}}}{w_{\mathrm{max}}}=\frac{2}{3}.
> $$
>
> *According to Magma experiments, there exists $y_1=[1,0,0,0,0,0]∈\mathbb{F}_3^6$ such that $\mathrm{dim}V(y_1,D)=4$. Then, it follows from Lemma 4 that $\mathcal{C}(D)$ is not minimal.*

## 4 Concluding Remarks

In this paper, we use the approach used in [14] to study the minimality of linear codes constructed from sunflowers in all cases. In [23], the authors proved that if the number *s* of the elements in a sunflower satisfying $s≥p+1$, then the corresponding linear code over $\mathbb{F}_p$ is minimal, where *p* is a prime number. Our results in this paper generalize [23] (Theorem 10). We discuss the minimality of linear codes constructed from sunflowers for all *s*. We obtain the following three results: (1) when $s≥q+1$, for any sunflower, the corresponding linear code is minimal; (2) when $2≤s≤3≤q$, for any sunflower, the corresponding linear code is not minimal; (3) when $3<s≤q$, for some sunflowers, the corresponding linear codes are minimal, whereas for some other sunflowers, the corresponding linear codes are not minimal.

## Author Contributions

Writing—original draft preparation, X.W.; writing—review and editing, W.L. All authors have read and agreed to the published version of the manuscript.

## Data Availability Statement

No new data were created or analyzed in this study. Data sharing is not applicable to this article.

## Conflicts of Interest

The authors declare no conflict of interest.

## Footnotes

- **Disclaimer/Publisher’s Note:** The statements, opinions and data contained in all publications are solely those of the individual author(s) and contributor(s) and not of MDPI and/or the editor(s). MDPI and/or the editor(s) disclaim responsibility for any injury to people or property resulting from any ideas, methods, instructions or products referred to in the content.

## References

- [1] Carlet C., Ding C., Yuan J. Linear codes from highly nonlinear functions and their secret sharing schemes. IEEE Trans. Inf. Theory. 2005;51:2089–2102. DOI 10.1109/TIT.2005.847722
- [2] Chabanne H., Cohen G., Patey A. Towards secure two-party computation from the wire-tap channel. In: Lee H.-S., Han D.-G., editors. Proceedings of the ICISC 2013. Berlin/Heidelberg, Germany: Springer; 2014;Volume 8565:34–46. Washington, DC, USA. 16–18 September 2013. Lecture Notes in Computer Science.
- [3] Ding C., Yuan J. Covering and secret sharing with linear codes. Discrete Mathematics and Theoretical Computer Science. Berlin/Heidelberg, Germany: Springer; 2003;Volume 2731:11–25. Lecture Notes in Computer Science.
- [4] Massey J.L. Minimal codewords and secret sharing. Proceedings of the 6th Joint Swedish-Russian Workshop on Information Theory. 246–249. Mölle, Sweden. 22–27 August 1993.
- [5] Yuan J., Ding C. Secret sharing schemes from three classes of linear codes. IEEE Trans. Inf. Theory. 2006;52:206–212. DOI 10.1109/TIT.2005.860412
- [6] Ashikhmin A., Barg A., Cohen G., Huguet L. Variations on minimal codewords in linear codes. In: Cohen G., Giusti M., Mora T., editors. Applied Algebra, Algebraic Algorithms and Error-Correcting Codes, (AAECC-11). Berlin/Heidelberg, Germany: Springer; 1995;Volume 948:96–105. Lecture Notes in Computer Science.
- [7] Cohen G.D., Mesnager S., Patey A. On minimal and quasi-minimal linear codes. In: Stam M., editors. Proceedings of IMACC. Berlin/Heidelberg, Germany: Springer; 2003;Volume 8308:85–98. Lecture Notes in Computer Science.
- [8] Ashikhmin A., Barg A. Minimal vectors in linear codes. IEEE Trans. Inf. Theory. 1998;44:2010–2017. DOI 10.1109/18.705584
- [9] Ding C., Fan C., Zhou Z. The dimension and minimum distance of two classes of primitive BCH codes. Finite Fields Appl. 2017;45:237–263. DOI 10.1016/j.ffa.2016.12.009
- [10] Zhou Z., Ding C. Seven Classes of Three-Weight Cyclic Codes. IEEE Trans. Commun. 2013;61:4120–4126. DOI 10.1109/TCOMM.2013.072213.130107
- [11] Ding C., Heng Z., Zhou Z. Minimal binary linear codes. IEEE Trans. Inf. Theory. 2018;64:6536–6545. DOI 10.1109/TIT.2018.2819196
- [12] Heng Z., Ding C., Zhou Z. Minimal linear codes over finite fields. Finite Fields Appl. 2018;54:176–196. DOI 10.1016/j.ffa.2018.08.010
- [13] Alfarano G.N., Borello M., Neri A. A geometric characterization of minimal codes and their asymptotic performance. Adv. Math. Commun. 2022;16:115–133. DOI 10.3934/amc.2020104
- [14] Lu W., Wu X. The parameters of minimal linear codes. Finite Fields Appl. 2021;71:176–196. DOI 10.1016/j.ffa.2020.101799
- [15] Tang C., Qiu Y., Liao Q., Zhou Z. Full Characterization of Minimal Linear Codes as Cutting Blocking Sets. IEEE Trans. Inf. Theory. 2021;67:3690–3700. DOI 10.1109/TIT.2021.3070377
- [16] Alfarano G.N., Borello M., Neri A., Ravagnani A. Three Combinatorial Perspectives on Minimal Codes. Siam J. Discret. Math. 2022;36:461–489. DOI 10.1137/21M1391493
- [17] Bartoli D., Bonini M. Minimal linear codes in odd characteristic. IEEE Trans. Inf. Theory. 2019;65:4152–4155. DOI 10.1109/TIT.2019.2891992
- [18] Bartoli D., Bonini M., Gunes B. An inductive construction of minimal codes. Cryptogr. Commun. 2021;13:439–449. DOI 10.1007/s12095-021-00474-2
- [19] Bartoli D., Cossidente A., Marino G., Pavese F. On cutting blocking sets and their codes. Forum Math. 2022;34:347–368. DOI 10.1515/forum-2020-0338
- [20] Bonini M., Borello M. Minimal linear codes arising from blocking sets. J. Algebr. Comb. 2021;53:327–341. DOI 10.1007/s10801-019-00930-6
- [21] Héger T., Nagy Z.L. Short minimal codes and covering codes via strong blocking sets in projective spaces. IEEE Trans. Inf. Theory. 2022;68:881–890. DOI 10.1109/TIT.2021.3123730
- [22] Gorla E., Ravagnani A. Equidistant subspace codes. Linear Algebra Its Appl. 2016;490:48–65. DOI 10.1016/j.laa.2015.10.029
- [23] Li X., Yue Q., Tang D. A family of linear codes from constant dimension subspace codes. Des. Codes Cryptogr. 2022;90:1–15. DOI 10.1007/s10623-021-00960-x
- [24] Lu W., Wu X., Cao X., Luo G., Qin X. Minimal linear codes constructed from partial spreads. arXiv. 2023. arXiv 2305.05320 DOI 10.3390/e25121669 PMCID PMC10742731 PMID 38136549
